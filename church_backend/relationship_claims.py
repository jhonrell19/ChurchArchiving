from io import BytesIO
import os

from flask import Blueprint, current_app, g, request, send_file
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import text
from models import db, Document, AuditLog

claims = Blueprint('claims', __name__)


def enabled():
    return os.getenv('PARISH_RELATIVE_CLAIMS') == 'enabled'


def supervisor():
    return g.user_role == 'ADMIN' and str(g.user_id) == os.getenv('PARISH_SUPER_ADMIN_ID', '')


def scope():
    scopes = current_app.config['PARISH_REPORT_SCOPE']
    return sum(scopes.values(), []) if supervisor() else scopes.get(g.user_role, [])


def proof_image():
    upload = request.files.get('proof')
    if not upload:
        raise ValueError()
    with Image.open(upload.stream, formats=('JPEG','PNG')) as image:
        if image.width * image.height > 20000000:
            raise ValueError()
        image.thumbnail((1600,1600))
        output = BytesIO()
        ImageOps.exif_transpose(image).convert('RGB').save(output,format='JPEG',quality=78)
        value = output.getvalue()
        if len(value)>1048576:
            raise ValueError()
        return value


@claims.before_request
def check_enabled():
    if not enabled():
        return {'error':'Relationship verification has not been enabled.'}, 503


@claims.route('/api/claims', methods=['GET','POST'])
def claim_list():
    uid = int(g.user_id)
    if request.method == 'POST':
        if g.user_role != 'USER':
            return {'error':'Forbidden'},403
        request.max_content_length = 3*1024*1024 + 32768
        name = request.form.get('name','').strip()
        category = request.form.get('category','').strip()
        relationship = request.form.get('relationship','').strip()
        categories = sum(current_app.config['PARISH_REPORT_SCOPE'].values(), [])
        if not 2<=len(name)<=160 or category not in categories or not 2<=len(relationship)<=80:
            return {'error':'Check the name, certificate type and relationship.'},400
        try:
            proof = proof_image()
        except (ValueError,OSError,UnidentifiedImageError,Image.DecompressionBombError):
            return {'error':'Choose a readable JPEG or PNG proof up to 3 MB.'},400
        # Serialize submissions per account to enforce the outstanding-claim limit.
        db.session.execute(text('SELECT pg_advisory_xact_lock(39012,:id)'),{'id':uid})
        open_count=db.session.scalar(text("SELECT count(*) FROM relationship_claim WHERE applicant_id=:id AND status IN ('pending','disputed')"),{'id':uid})
        if open_count>=5:
            return {'error':'Five claims are awaiting review.'},409
        claim_id=db.session.scalar(text('''INSERT INTO relationship_claim(applicant_id,owner_name,category,relationship,proof)
            VALUES(:id,:name,:category,:relationship,:proof) RETURNING id'''),dict(id=uid,name=name,category=category,relationship=relationship,proof=proof))
        db.session.add(AuditLog(user=g.user_email,action=f'Submitted relationship claim #{claim_id}'))
        db.session.commit()
        return {'id':claim_id},201
    try:
        page=int(request.args.get('page','1'))
        if not 1<=page<=100000: raise ValueError()
    except ValueError:
        return {'error':'Invalid page'},400
    where = 'applicant_id=:uid' if g.user_role=='USER' else 'category=ANY(:types)'
    params={'uid':uid,'types':scope(),'offset':(page-1)*20}
    rows=db.session.execute(text(f'''SELECT id,owner_name,category,relationship,status,reason FROM relationship_claim
        WHERE {where} ORDER BY id DESC OFFSET :offset LIMIT 21'''),params).mappings().all()
    return {'items':[dict(row) for row in rows[:20]],'hasNext':len(rows)>20,'supervisor':supervisor()}


@claims.get('/api/claims/<int:claim_id>/proof')
def read_proof(claim_id):
    if not scope(): return {'error':'Forbidden'},403
    data=db.session.scalar(text('SELECT proof FROM relationship_claim WHERE id=:id AND category=ANY(:types)'),{'id':claim_id,'types':scope()})
    if not data: return {'error':'Unavailable'},404
    response=send_file(BytesIO(bytes(data)),mimetype='image/jpeg')
    response.headers['Cache-Control']='private, no-store'
    response.headers['X-Content-Type-Options']='nosniff'
    return response


@claims.post('/api/claims/<int:claim_id>/review')
def review_claim(claim_id):
    if not scope(): return {'error':'Forbidden'},403
    body=request.get_json(silent=True) or {}
    decision=body.get('decision')
    reason=body.get('reason')
    if decision not in ('approved','rejected','disputed') or not isinstance(reason,str) or not 5<=len(reason.strip())<=500:
        return {'error':'Choose a decision and provide a reason of 5–500 characters.'},400
    claim=db.session.execute(text('SELECT * FROM relationship_claim WHERE id=:id AND category=ANY(:types) FOR UPDATE'),
                             {'id':claim_id,'types':scope()}).mappings().first()
    if not claim:return {'error':'Unavailable'},404
    if claim['status'] not in ('pending','disputed') or (claim['status']=='disputed' and (not supervisor() or decision=='disputed')):
        return {'error':'This decision is unavailable.'},409
    document_id=None
    if decision=='approved':
        matches=Document.query.filter_by(active=True,sacrament_type=claim['category'],certificate_number=body.get('certificate')).limit(2).all()
        if len(matches)!=1 or (matches[0].person_name or '').strip().casefold()!=claim['owner_name'].strip().casefold() or body.get('checked') is not True:
            return {'error':'Confirm the proof against a unique matching certificate and record owner.'},400
        document_id=matches[0].id
    db.session.execute(text('''UPDATE relationship_claim SET status=:status,reviewer_id=:reviewer,reviewed_at=now(),
        reason=:reason,document_id=:doc WHERE id=:id'''),{'status':decision,'reviewer':int(g.user_id),'reason':reason.strip(),'doc':document_id,'id':claim_id})
    db.session.add(AuditLog(user=g.user_email,action=f'Relationship claim #{claim_id}: {decision}',document_id=document_id))
    db.session.commit()
    return {'status':decision}
