"""Certificate activity grouped by creation month in the parish timezone."""
from datetime import date, datetime, time, timedelta, timezone
from io import BytesIO

from flask import Blueprint, g, request, send_file
from sqlalchemy import func, case

from models import CertificateRequest as Record, db

reports = Blueprint("reports", __name__)
PARISH_TZ = timezone(timedelta(hours=8))


@reports.get("/api/reports/certificates")
def certificate_report():
    from flask import current_app
    scope = current_app.config["PARISH_REPORT_SCOPE"].get(g.user_role)
    if not scope:
        return {"error": "Forbidden"}, 403
    today = datetime.now(PARISH_TZ).date()
    try:
        start = date.fromisoformat(request.args.get("from", today.replace(day=1).isoformat()))
        end = date.fromisoformat(request.args.get("to", today.isoformat()))
        if not 0 <= (end - start).days <= 366:
            raise ValueError()
        first = datetime.combine(start, time.min, PARISH_TZ).astimezone(timezone.utc).replace(tzinfo=None)
        last = datetime.combine(end + timedelta(days=1), time.min, PARISH_TZ).astimezone(timezone.utc).replace(tzinfo=None)
    except (ValueError, OverflowError):
        return {"error": "Choose a range of up to 367 days."}, 400
    fmt = request.args.get("format", "json")
    if fmt not in {"json", "pdf", "xlsx"}:
        return {"error": "Unknown export format."}, 400
    basis = request.args.get("basis", "created")
    if basis not in {"created", "paid"}:
        return {"error": "Unknown report date basis."}, 400
    by_payment = basis == "paid"
    timestamp = Record.paid_at if by_payment else Record.created_at
    heading = "Payments received" if by_payment else "Requests created"
    month = func.to_char(timestamp + timedelta(hours=8), 'YYYY-MM')
    # Revenue excludes demo/test payments and unpaid request quotes.
    collected = case(((Record.payment_status == 'Paid') &
                      (func.upper(Record.payment_method).in_(['CASH', 'PAYMONGO_LIVE'])), Record.total_fee), else_=0)
    query = db.session.query(month, Record.sacrament_type, Record.status,
                             func.count(Record.id), func.sum(collected)).filter(
        Record.sacrament_type.in_(scope), timestamp >= first, timestamp < last)
    if by_payment:
        query = query.filter(Record.payment_status == "Paid",
                             func.upper(Record.payment_method).in_(["CASH", "PAYMONGO_LIVE"]))
    for key, column in [('type', Record.sacrament_type), ('status', Record.status), ('method', Record.payment_method)]:
        value = request.args.get(key)
        if value:
            query = query.filter(column == value)
    rows = [dict(month=m, type=t, status=s, requests=n, collected=int(p or 0))
            for m, t, s, n, p in query.group_by(month, Record.sacrament_type, Record.status)
            .order_by(month, Record.sacrament_type, Record.status)]
    if fmt == "json":
        return {"rows": rows, "from": start.isoformat(), "to": end.isoformat(), "types": scope}
    columns = ["Month", "Certificate", "Status", "Requests", "Collected PHP"]
    values = [[r[k] for k in ("month", "type", "status", "requests", "collected")] for r in rows]
    output = BytesIO()
    if fmt == "xlsx":
        from openpyxl import Workbook
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Certificate activity"
        sheet.append([heading, start.isoformat(), end.isoformat()])
        sheet.append(columns)
        for row in values:
            sheet.append(row)
            for cell in sheet[sheet.max_row][:3]:
                cell.data_type = "s"
        sheet.freeze_panes = "A3"
        workbook.save(output)
        mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
        from reportlab.lib.styles import getSampleStyleSheet
        table = Table([columns] + values, repeatRows=1)
        table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#24543e")),
                                   ("TEXTCOLOR", (0, 0), (-1, 0), colors.white)]))
        SimpleDocTemplate(output).build([Paragraph(f"{heading}: {start} to {end}", getSampleStyleSheet()["Heading1"]), table])
        mime = "application/pdf"
    output.seek(0)
    response = send_file(output, mimetype=mime, as_attachment=True, download_name=f"certificate-activity-{start}-{end}.{fmt}")
    response.headers["Cache-Control"] = "private, no-store"
    return response


def is_supervisor():
    import os
    return g.user_role == 'ADMIN' and str(g.user_id) == os.environ.get('PARISH_SUPER_ADMIN_ID', '')


@reports.route('/api/reports/members',methods=['GET','POST'])
def member_activity():
    from sqlalchemy import text
    import os
    if not is_supervisor():
        return {'error':'Forbidden'},403
    if os.getenv('PARISH_EXTENDED_REPORTS')!='enabled':
        return {'error':'Reporting configuration is pending.'},503
    if request.method=='POST':
        body=request.get_json(silent=True) or {}
        status=body.get('status')
        email=body.get('email')
        reason=body.get('reason')
        if status not in ('active','inactive') or not isinstance(email,str) or not isinstance(reason,str) or not 5<=len(reason.strip())<=500:
            return {'error':'Select a status, member email and review reason.'},400
        from models import AuditLog
        uid=db.session.scalar(text('''SELECT id FROM parish_auth."User" WHERE email=:email AND role='USER' AND "membershipStatus"='approved' '''),
                              {'email':email.strip().lower()})
        if not uid: return {'error':'Approved parishioner unavailable.'},404
        db.session.execute(text('''INSERT INTO member_activity(user_id,status,reason,changed_by) VALUES(:id,:s,:r,:a)
            ON CONFLICT(user_id) DO UPDATE SET status=excluded.status,reason=excluded.reason,changed_by=excluded.changed_by,changed_at=now()'''),
            {'id':uid,'s':status,'r':reason.strip(),'a':int(g.user_id)})
        db.session.add(AuditLog(user=g.user_email,action=f'Member #{uid} set to {status}: {reason.strip()[:300]}'))
        db.session.commit()
        return {'ok':True}
    def rows(sql, params=None):
        return [dict(r) for r in db.session.execute(text(sql),params or {}).mappings()]
    actor=(request.args.get('actor') or '').strip()[:200]
    return {
        'membership':rows('''SELECT coalesce(m.status,'unassessed') AS label,count(*) AS value FROM parish_auth."User" u
            LEFT JOIN member_activity m ON m.user_id=u.id WHERE u.role='USER' AND u."membershipStatus"='approved' GROUP BY 1 ORDER BY 1'''),
        'registrations':rows('''SELECT to_char("createdAt"+interval '8 hours','YYYY-MM') AS label,count(*) AS value
            FROM parish_auth."User" WHERE role='USER' AND "createdAt">=now()-interval '1 year' GROUP BY 1 ORDER BY 1'''),
        'cemetery':rows('SELECT status AS label,count(*) AS value FROM cemetery_slot WHERE active GROUP BY 1 ORDER BY 1'),
        'staff':rows('''SELECT a."user" AS label,count(*) AS value FROM audit_log a JOIN parish_auth."User" u ON u.email=a."user"
            WHERE u.role IN ('ADMIN','BURIAL_ADMIN') AND a.created_at >=now()-interval '30 days'
            AND (:actor='' OR a."user"=:actor) GROUP BY 1 ORDER BY 2 DESC LIMIT 30''',{'actor':actor}),
        'appointments':rows('''SELECT office AS label,coalesce(sum(capacity),0) AS capacity,
            coalesce(sum((SELECT count(*) FROM appointment_booking b WHERE b.slot_id=s.id)),0) AS value
            FROM appointment_slot s WHERE starts_at>=now() GROUP BY office ORDER BY office'''),
        'storage':rows('''SELECT split_part(logical_path,'/',2) AS label,sum(size_bytes) AS value
            FROM upload_object GROUP BY 1 ORDER BY 1''')
    }


@reports.route('/api/reports/schedules',methods=['GET','POST'])
def schedules():
    from sqlalchemy import text
    import os
    if not is_supervisor():return {'error':'Forbidden'},403
    if os.getenv('PARISH_EXTENDED_REPORTS')!='enabled':return {'error':'Reporting configuration is pending.'},503
    if request.method=='GET':
        result=db.session.execute(text('''SELECT id,frequency,format,office,enabled,next_run::text,category,request_status,payment_method,
            (SELECT max(due)::text FROM report_run WHERE schedule_id=s.id) AS latest FROM report_schedule s ORDER BY id DESC LIMIT 100''')).mappings()
        return {'items':[dict(r) for r in result]}
    body=request.get_json(silent=True) or {}
    if body.get('action')=='disable' and type(body.get('id'))==int:
        db.session.execute(text('UPDATE report_schedule SET enabled=false WHERE id=:id'),{'id':body['id']})
    else:
        freq,fmt,office=body.get('frequency'),body.get('format'),body.get('office')
        if freq not in ('weekly','monthly') or fmt not in ('pdf','xlsx') or office not in ('main','burial'):
            return {'error':'Invalid schedule'},400
        from flask import current_app
        allowed=current_app.config['PARISH_REPORT_SCOPE']['ADMIN' if office=='main' else 'BURIAL_ADMIN']
        category=body.get('type') or None
        status=body.get('status') or None
        method=body.get('method') or None
        if (category and category not in allowed) or status not in (None,'Pending','Approved','Ready','Released','Rejected') or method not in (None,'CASH','PAYMONGO_LIVE','PAYMONGO_TEST'):
            return {'error':'Invalid report filters.'},400
        db.session.execute(text('''INSERT INTO report_schedule(frequency,format,office,created_by,next_run,category,request_status,payment_method)
            VALUES(:f,:fmt,:office,:uid,(now() AT TIME ZONE 'Asia/Manila')::date,:category,:status,:method)'''),
            dict(f=freq,fmt=fmt,office=office,uid=int(g.user_id),category=category,status=status,method=method))
    db.session.commit()
    return {'ok':True}


@reports.get('/api/reports/schedules/<int:schedule_id>/latest')
def latest_report(schedule_id):
    from sqlalchemy import text
    if not is_supervisor():return {'error':'Forbidden'},403
    row=db.session.execute(text('''SELECT r.report,s.format FROM report_run r JOIN report_schedule s ON s.id=r.schedule_id
        WHERE s.id=:id ORDER BY r.due DESC LIMIT 1'''),{'id':schedule_id}).first()
    if not row:return {'error':'No generated report'},404
    return send_file(BytesIO(bytes(row.report)),as_attachment=True,download_name=f'parish-report-{schedule_id}.{row.format}',max_age=0)
