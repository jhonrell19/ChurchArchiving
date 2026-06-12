from flask import (
    Flask,
    render_template,
    request,
    redirect,
    send_from_directory,
    jsonify,
)

from flask_cors import CORS
from docxtpl import DocxTemplate
from models import db, Document, AuditLog, CertificateRequest, MassRecord, Announcement
from faster_whisper import WhisperModel
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
import subprocess
import os

app = Flask(__name__)
CORS(app)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///archive.db"
app.config["SECRET_KEY"] = "churchsecret"

MASS_UPLOAD_FOLDER = "uploads/masses"
TRANSCRIPTION_FOLDER = "uploads/transcriptions"

os.makedirs(MASS_UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRANSCRIPTION_FOLDER, exist_ok=True)

model = WhisperModel("base", device="cpu", compute_type="int8")

db.init_app(app)

with app.app_context():
    db.create_all()


def highlight_best(text):
    sentences = text.split(".")
    if not sentences:
        return text

    best = max(sentences, key=len)
    return best.strip()


def format_text(text):
    text = text.replace(" um ", " ")
    text = text.replace(" uh ", " ")

    sentences = text.split(".")
    paragraphs = []

    chunk = []

    for sentence in sentences:
        clean_sentence = sentence.strip()

        if clean_sentence:
            chunk.append(clean_sentence)

        if len(chunk) >= 5:
            paragraphs.append(". ".join(chunk) + ".")
            chunk = []

    if chunk:
        paragraphs.append(". ".join(chunk) + ".")

    return "\n\n".join(paragraphs)


def create_pdf(text, highlight, filename):
    doc = SimpleDocTemplate(filename)
    styles = getSampleStyleSheet()

    content = []

    content.append(Paragraph("<b>Mass Transcription</b>", styles["Title"]))
    content.append(Spacer(1, 20))

    content.append(Paragraph("<b>Best Highlight:</b>", styles["Heading2"]))
    content.append(Paragraph(highlight, styles["BodyText"]))
    content.append(Spacer(1, 20))

    content.append(Paragraph("<b>Full Transcript:</b>", styles["Heading2"]))
    content.append(Paragraph(text.replace("\n", "<br/><br/>"), styles["BodyText"]))

    doc.build(content)

@app.route("/")
def home():
    query = request.args.get("query")
    sacrament = request.args.get("sacrament")

    documents = Document.query.filter_by(active=True)

    if query:
        documents = documents.filter(Document.person_name.contains(query))

    if sacrament and sacrament != "All":
        documents = documents.filter_by(sacrament_type=sacrament)

    documents = documents.all()

    return render_template("index.html", documents=documents)


@app.route("/dashboard")
def dashboard():
    sacrament_types = ["baptismal", "marriage", "death", "hermana"]

    return render_template(
        "dashboard.html",
        sacrament_types=sacrament_types
    )


@app.route("/folder/<sacrament_type>")
def folder(sacrament_type):
    documents = Document.query.filter_by(
        sacrament_type=sacrament_type,
        active=True
    ).order_by(Document.person_name.asc()).all()

    return render_template(
        "folder.html",
        documents=documents,
        sacrament_type=sacrament_type
    )


@app.route("/upload", methods=["GET", "POST"])
def upload():
    if request.method == "POST":

        person_name = request.form.get("person_name")
        sacrament_type = request.form.get("sacrament_type")
        parish = request.form.get("parish")
        priest = request.form.get("priest")
        date_of_record = request.form.get("date_of_record")

        file = request.files.get("file")

        if not file:
            return "No file uploaded"

        folder = f"uploads/{sacrament_type}"
        os.makedirs(folder, exist_ok=True)

        filepath = os.path.join(folder, file.filename)
        file.save(filepath)

        new_document = Document(
            person_name=person_name,
            sacrament_type=sacrament_type,
            parish=parish,
            priest=priest,
            date_of_record=date_of_record,
            filename=file.filename,
            filepath=filepath,
            uploaded_by="Admin"
        )

        db.session.add(new_document)
        db.session.commit()

        log = AuditLog(
            user="Admin",
            action=f"Uploaded {file.filename}",
            document_id=new_document.id
        )

        db.session.add(log)
        db.session.commit()

        return redirect("/dashboard")

    return render_template("upload.html")


@app.route("/request-baptismal", methods=["GET", "POST"])
def request_baptismal():
    if request.method == "POST":

        data = {
            "Church_Name": request.form.get("Church_Name"),
            "Church_Address": request.form.get("Church_Address"),
            "Contact_Information": request.form.get("Contact_Information"),
            "Full_Name": request.form.get("Full_Name"),
            "Fathers_fullName": request.form.get("Fathers_fullName"),
            "Mothers_fullName": request.form.get("Mothers_fullName"),
            "Date_birt": request.form.get("Date_birt"),
            "Place_birth": request.form.get("Place_birth"),
            "Name_church": request.form.get("Name_church"),
            "Date_of_Baptism": request.form.get("Date_of_Baptism"),
            "Name_of_Priest": request.form.get("Name_of_Priest"),
            "Church_Location": request.form.get("Church_Location"),
            "Name_of_Godfather": request.form.get("Name_of_Godfather"),
            "Name_of_Godmother": request.form.get("Name_of_Godmother")
        }

        os.makedirs("generated", exist_ok=True)

        doc = DocxTemplate(
            "templates/certificates/baptismal_template.docx"
        )

        doc.render(data)

        safe_name = data["Full_Name"].replace(" ", "_")

        output_filename = f"{safe_name}_Baptismal.docx"
        output_docx = os.path.join("generated", output_filename)

        doc.save(output_docx)

        new_document = Document(
            person_name=data["Full_Name"],
            sacrament_type="baptismal",
            parish=data["Church_Name"],
            priest=data["Name_of_Priest"],
            date_of_record=data["Date_of_Baptism"],
            filename=output_filename,
            filepath=output_docx,
            uploaded_by="User Request"
        )

        db.session.add(new_document)
        db.session.commit()

        log = AuditLog(
            user="User Request",
            action=f"Generated baptismal certificate for {data['Full_Name']}",
            document_id=new_document.id
        )

        db.session.add(log)
        db.session.commit()

        return (
            "Certificate Generated and Saved to Archive!<br><br>"
            f"<a href='/generated/{output_filename}'>Download Certificate</a><br><br>"
            "<a href='/'>Back to Main Page</a>"
        )

    return render_template("request_baptismal.html")


@app.route("/search")
def search():
    query = request.args.get("query")

    results = []

    if query:
        results = Document.query.filter(
            Document.person_name.contains(query),
            Document.active == True
        ).all()

    return render_template("search.html", results=results)


@app.route("/delete/<int:id>")
def delete(id):
    document = Document.query.get(id)

    if document:
        document.active = False
        db.session.commit()

        log = AuditLog(
            user="Admin",
            action=f"Deleted document {id}",
            document_id=id
        )

        db.session.add(log)
        db.session.commit()

    return redirect("/dashboard")


@app.route("/generated/<filename>")
def download_generated(filename):
    return send_from_directory(
        "generated",
        filename,
        as_attachment=True
    )


@app.route("/files/<path:filepath>")
def view_file(filepath):
    return send_from_directory(
        ".",
        filepath,
        as_attachment=False
    )

@app.route("/api/archive/upload", methods=["POST"])
def api_upload_document():
    try:
        file = request.files.get("file")

        if not file:
            return {"error": "No file uploaded"}, 400

        person_name = request.form.get("person_name")
        sacrament_type = request.form.get("sacrament_type")
        parish = request.form.get("parish")
        priest = request.form.get("priest")
        date_of_record = request.form.get("date_of_record")
        book_number = request.form.get("book_number")
        page_number = request.form.get("page_number")
        document_type = request.form.get("document_type")

        if not person_name or not sacrament_type:
            return {"error": "Person name and sacrament type are required"}, 400

        prefix_map = {
            "baptismal": "BAP",
            "confirmation": "CNF",
            "marriage": "MRG",
            "death": "DTH",
        }

        prefix = prefix_map.get(sacrament_type, "DOC")
        year = date_of_record[:4] if date_of_record else "2026"

        existing_count = Document.query.filter_by(
            sacrament_type=sacrament_type,
            active=True
        ).count()

        next_number = existing_count + 1
        certificate_number = f"{prefix}-{year}-{next_number:03d}"

        upload_folder = os.path.join("uploads", sacrament_type)
        os.makedirs(upload_folder, exist_ok=True)

        filename = file.filename
        filepath = os.path.join(upload_folder, filename)

        file.save(filepath)

        new_document = Document(
            person_name=person_name,
            sacrament_type=sacrament_type,
            parish=parish,
            priest=priest,
            date_of_record=date_of_record,
            book_number=book_number,
            page_number=page_number,
            certificate_number=certificate_number,
            document_type=document_type,
            filename=filename,
            filepath=filepath,
            uploaded_by="Admin"
        )

        db.session.add(new_document)
        db.session.commit()

        log = AuditLog(
            user="Admin",
            action=f"Uploaded {sacrament_type} archive record: {person_name} ({certificate_number})",
            document_id=new_document.id
        )

        db.session.add(log)
        db.session.commit()

        return {
            "message": "Document uploaded successfully",
            "document": {
                "id": new_document.id,
                "personName": new_document.person_name,
                "sacramentType": new_document.sacrament_type,
                "certificateNumber": new_document.certificate_number,
                "filename": new_document.filename,
                "filepath": new_document.filepath
            }
        }, 201

    except Exception as e:
        return {"error": str(e)}, 500
    
@app.route("/api/archive/stats")
def api_archive_stats():
    total_records = Document.query.filter_by(active=True).count()

    baptismal = Document.query.filter_by(
        active=True,
        sacrament_type="baptismal"
    ).count()

    marriage = Document.query.filter_by(
        active=True,
        sacrament_type="marriage"
    ).count()

    confirmation = Document.query.filter_by(
        active=True,
        sacrament_type="confirmation"
    ).count()

    death = Document.query.filter_by(
        active=True,
        sacrament_type="death"
    ).count()

    generated = Document.query.filter_by(
        active=True,
        uploaded_by="User Request"
    ).count()

    return {
        "totalRecords": total_records,
        "baptismal": baptismal,
        "marriage": marriage,
        "confirmation": confirmation,
        "death": death,
        "generatedCertificates": generated
    }


@app.route("/api/archive/documents")
def api_archive_documents():
    documents = Document.query.filter_by(active=True).order_by(
        Document.person_name.asc()
    ).all()

    return {
        "documents": [
            {
                "id": d.id,
                "personName": d.person_name,
                "sacramentType": d.sacrament_type,
                "parish": d.parish,
                "priest": d.priest,
                "dateOfRecord": d.date_of_record,
                "certificateNumber": d.certificate_number,
                "documentType": d.document_type,
                "filename": d.filename,
                "filepath": d.filepath,
                "uploadedBy": d.uploaded_by,
            }
            for d in documents
        ]
    }


@app.route("/api/archive/documents/<sacrament_type>")
def api_archive_documents_by_type(sacrament_type):
    documents = Document.query.filter_by(
        active=True,
        sacrament_type=sacrament_type
    ).order_by(Document.person_name.asc()).all()

    return {
        "documents": [
            {
                "id": d.id,
                "personName": d.person_name,
                "sacramentType": d.sacrament_type,
                "parish": d.parish,
                "priest": d.priest,
                "dateOfRecord": d.date_of_record,
                "certificateNumber": d.certificate_number,
                "documentType": d.document_type,
                "filename": d.filename,
                "filepath": d.filepath,
                "uploadedBy": d.uploaded_by,
            }
            for d in documents
        ]
    }

@app.route("/api/archive/audit-logs")
def api_audit_logs():
    logs = AuditLog.query.order_by(AuditLog.id.desc()).limit(20).all()

    return {
        "logs": [
            {
                "id": log.id,
                "user": log.user,
                "action": log.action,
                "documentId": log.document_id
            }
            for log in logs
        ]
    }

@app.route("/api/requests", methods=["POST"])
def api_create_request():
    try:
        data = request.get_json()

        requester_name = data.get("requesterName")
        requester_email = data.get("requesterEmail")
        contact_number = data.get("contactNumber")
        sacrament_type = data.get("sacramentType")
        person_name = data.get("personName")
        purpose = data.get("purpose")

        if not requester_name or not sacrament_type or not person_name:
            return {"error": "Requester name, sacrament type, and person name are required"}, 400

        new_request = CertificateRequest(
            requester_name=requester_name,
            requester_email=requester_email,
            contact_number=contact_number,
            sacrament_type=sacrament_type,
            person_name=person_name,
            purpose=purpose,
            status="Pending"
        )

        db.session.add(new_request)
        db.session.commit()

        log = AuditLog(
            user=requester_name,
            action=f"Submitted {sacrament_type} certificate request for {person_name}",
            document_id=None
        )

        db.session.add(log)
        db.session.commit()

        return {
            "message": "Request submitted successfully",
            "request": {
                "id": new_request.id,
                "requesterName": new_request.requester_name,
                "requesterEmail": new_request.requester_email,
                "contactNumber": new_request.contact_number,
                "sacramentType": new_request.sacrament_type,
                "personName": new_request.person_name,
                "purpose": new_request.purpose,
                "status": new_request.status,
                "remarks": new_request.remarks,
                "createdAt": new_request.created_at.isoformat()
            }
        }, 201

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/api/requests", methods=["GET"])
def api_get_requests():
    try:
        requests_list = CertificateRequest.query.order_by(
            CertificateRequest.id.desc()
        ).all()

        return {
            "requests": [
                {
                    "id": r.id,
                    "requesterName": r.requester_name,
                    "requesterEmail": r.requester_email,
                    "contactNumber": r.contact_number,
                    "sacramentType": r.sacrament_type,
                    "personName": r.person_name,
                    "purpose": r.purpose,
                    "status": r.status,
                    "remarks": r.remarks,
                    "matchedDocumentId": r.matched_document_id,
                    "generatedFile": r.generated_file,
                    "createdAt": r.created_at.isoformat() if r.created_at else None,
                    "updatedAt": r.updated_at.isoformat() if r.updated_at else None
                }
                for r in requests_list
            ]
        }

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/api/requests/<int:request_id>", methods=["GET"])
def api_get_single_request(request_id):
    cert_request = CertificateRequest.query.get(request_id)

    if not cert_request:
        return {"error": "Request not found"}, 404

    return {
        "request": {
            "id": cert_request.id,
            "requesterName": cert_request.requester_name,
            "requesterEmail": cert_request.requester_email,
            "contactNumber": cert_request.contact_number,
            "sacramentType": cert_request.sacrament_type,
            "personName": cert_request.person_name,
            "purpose": cert_request.purpose,
            "status": cert_request.status,
            "remarks": cert_request.remarks,
            "matchedDocumentId": cert_request.matched_document_id,
            "generatedFile": cert_request.generated_file,
            "createdAt": cert_request.created_at.isoformat() if cert_request.created_at else None,
            "updatedAt": cert_request.updated_at.isoformat() if cert_request.updated_at else None
        }
    }


@app.route("/api/requests/<int:request_id>/status", methods=["PATCH"])
def api_update_request_status(request_id):
    try:
        cert_request = CertificateRequest.query.get(request_id)

        if not cert_request:
            return {"error": "Request not found"}, 404

        data = request.get_json()

        status = data.get("status")
        remarks = data.get("remarks")

        allowed_statuses = ["Pending", "Approved", "Rejected", "Ready", "Released"]

        if status not in allowed_statuses:
            return {"error": "Invalid status"}, 400

        cert_request.status = status

        if remarks is not None:
            cert_request.remarks = remarks

        db.session.commit()

        log = AuditLog(
            user="Admin",
            action=f"Updated request #{cert_request.id} status to {status}",
            document_id=cert_request.matched_document_id
        )

        db.session.add(log)
        db.session.commit()

        return {
            "message": "Request status updated successfully",
            "request": {
                "id": cert_request.id,
                "status": cert_request.status,
                "remarks": cert_request.remarks
            }
        }

    except Exception as e:
        return {"error": str(e)}, 500
    

@app.route("/api/requests/<int:request_id>/attach-document", methods=["PATCH"])
def api_attach_document_to_request(request_id):
    try:
        cert_request = CertificateRequest.query.get(request_id)

        if not cert_request:
            return {"error": "Request not found"}, 404

        data = request.get_json()
        document_id = data.get("documentId")

        if not document_id:
            return {"error": "Document ID is required"}, 400

        document = Document.query.get(document_id)

        if not document or not document.active:
            return {"error": "Archive document not found"}, 404

        cert_request.matched_document_id = document.id
        cert_request.generated_file = document.filepath
        cert_request.status = "Ready"
        cert_request.remarks = data.get("remarks") or "Your requested document is ready for release."

        db.session.commit()

        log = AuditLog(
            user="Admin",
            action=f"Attached archive document #{document.id} to request #{cert_request.id}",
            document_id=document.id
        )

        db.session.add(log)
        db.session.commit()

        return {
            "message": "Document attached successfully",
            "request": {
                "id": cert_request.id,
                "status": cert_request.status,
                "matchedDocumentId": cert_request.matched_document_id,
                "generatedFile": cert_request.generated_file,
                "remarks": cert_request.remarks
            }
        }

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/download/<path:filepath>")
def download_file(filepath):
    return send_from_directory(
        ".",
        filepath,
        as_attachment=True
    )

@app.route("/api/masses", methods=["GET"])
def api_get_masses():
    try:
        masses = MassRecord.query.filter_by(active=True).order_by(
            MassRecord.id.desc()
        ).all()

        return {
            "masses": [
                {
                    "id": m.id,
                    "title": m.title,
                    "priest": m.priest,
                    "category": m.category,
                    "date": m.mass_date,
                    "duration": m.duration,
                    "status": m.status,
                    "filename": m.filename,
                    "filepath": m.filepath,
                    "transcriptText": m.transcript_text,
                    "summaryText": m.summary_text,
                    "transcriptFilename": m.transcript_filename,
                    "transcriptFilepath": m.transcript_filepath,
                    "createdAt": m.created_at.isoformat() if m.created_at else None,
                    "updatedAt": m.updated_at.isoformat() if m.updated_at else None,
                    "hasTranscript": bool(m.transcript_text or m.summary_text or m.transcript_filepath)
                }
                for m in masses
            ]
        }

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/api/masses", methods=["POST"])
def api_create_mass():
    try:
        title = request.form.get("title")
        priest = request.form.get("priest")
        category = request.form.get("category")
        mass_date = request.form.get("date")
        duration = request.form.get("duration")
        status = request.form.get("status") or "Pending"

        file = request.files.get("file")

        if not title:
            return {"error": "Mass title is required"}, 400

        filename = None
        filepath = None

        if file:
            folder = "uploads/masses"
            os.makedirs(folder, exist_ok=True)

            filename = file.filename
            filepath = os.path.join(folder, filename)
            file.save(filepath)

        new_mass = MassRecord(
            title=title,
            priest=priest,
            category=category,
            mass_date=mass_date,
            duration=duration,
            status=status,
            filename=filename,
            filepath=filepath
        )

        db.session.add(new_mass)
        db.session.commit()

        log = AuditLog(
            user="Admin",
            action=f"Created mass record: {title}",
            document_id=None
        )

        db.session.add(log)
        db.session.commit()

        return {
            "message": "Mass record created successfully",
            "mass": {
                "id": new_mass.id,
                "title": new_mass.title,
                "priest": new_mass.priest,
                "category": new_mass.category,
                "date": new_mass.mass_date,
                "duration": new_mass.duration,
                "status": new_mass.status,
                "filename": new_mass.filename,
                "filepath": new_mass.filepath
            }
        }, 201

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/api/masses/<int:mass_id>/status", methods=["PATCH"])
def api_update_mass_status(mass_id):
    try:
        mass = MassRecord.query.get(mass_id)

        if not mass or not mass.active:
            return {"error": "Mass record not found"}, 404

        data = request.get_json()
        status = data.get("status")

        allowed_statuses = ["Pending", "In Progress", "Transcribed"]

        if status not in allowed_statuses:
            return {"error": "Invalid status"}, 400

        mass.status = status
        db.session.commit()

        return {
            "message": "Mass status updated successfully",
            "mass": {
                "id": mass.id,
                "status": mass.status
            }
        }

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/api/masses/<int:mass_id>/transcription", methods=["PATCH"])
def api_update_mass_transcription(mass_id):
    try:
        mass = MassRecord.query.get(mass_id)

        if not mass or not mass.active:
            return {"error": "Mass record not found"}, 404

        data = request.get_json()

        transcript_text = data.get("transcriptText")
        summary_text = data.get("summaryText")

        mass.transcript_text = transcript_text
        mass.summary_text = summary_text
        mass.status = "Transcribed"

        db.session.commit()

        log = AuditLog(
            user="Admin",
            action=f"Added transcription and summary for mass #{mass.id}",
            document_id=None
        )

        db.session.add(log)
        db.session.commit()

        return {
            "message": "Transcription saved successfully",
            "mass": {
                "id": mass.id,
                "title": mass.title,
                "status": mass.status,
                "transcriptText": mass.transcript_text,
                "summaryText": mass.summary_text
            }
        }

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/api/masses/<int:mass_id>", methods=["DELETE"])
def api_delete_mass(mass_id):
    try:
        mass = MassRecord.query.get(mass_id)

        if not mass or not mass.active:
            return {"error": "Mass record not found"}, 404

        mass.active = False
        db.session.commit()

        return {
            "message": "Mass record deleted successfully"
        }

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/api/transcriptions", methods=["GET"])
def api_get_transcriptions():
    try:
        masses = MassRecord.query.filter(
            MassRecord.active == True,
            MassRecord.status == "Transcribed"
        ).order_by(MassRecord.id.desc()).all()

        return {
            "transcriptions": [
                {
                    "id": m.id,
                    "massTitle": m.title,
                    "priest": m.priest,
                    "date": m.mass_date,
                    "duration": m.duration,
                    "category": m.category,
                    "transcriptText": m.transcript_text,
                    "summaryText": m.summary_text,
                    "transcriptFilename": m.transcript_filename,
                    "transcriptFilepath": m.transcript_filepath,
                    "words": len(m.transcript_text.split()) if m.transcript_text else 0
                }
                for m in masses
            ]
        }

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/api/announcements", methods=["GET"])
def api_get_announcements():
    try:
        announcements = Announcement.query.filter_by(active=True).order_by(
            Announcement.id.desc()
        ).all()

        return {
            "announcements": [
                {
                    "id": a.id,
                    "title": a.title,
                    "category": a.category,
                    "date": a.announcement_date,
                    "body": a.body,
                    "createdAt": a.created_at.isoformat() if a.created_at else None
                }
                for a in announcements
            ]
        }

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/api/announcements", methods=["POST"])
def api_create_announcement():
    try:
        data = request.get_json()

        title = data.get("title")
        category = data.get("category")
        announcement_date = data.get("date")
        body = data.get("body")

        if not title or not body:
            return {"error": "Title and body are required"}, 400

        new_announcement = Announcement(
            title=title,
            category=category,
            announcement_date=announcement_date,
            body=body
        )

        db.session.add(new_announcement)
        db.session.commit()

        log = AuditLog(
            user="Admin",
            action=f"Published announcement: {title}",
            document_id=None
        )

        db.session.add(log)
        db.session.commit()

        return {
            "message": "Announcement published successfully",
            "announcement": {
                "id": new_announcement.id,
                "title": new_announcement.title,
                "category": new_announcement.category,
                "date": new_announcement.announcement_date,
                "body": new_announcement.body
            }
        }, 201

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/api/announcements/<int:announcement_id>", methods=["DELETE"])
def api_delete_announcement(announcement_id):
    try:
        announcement = Announcement.query.get(announcement_id)

        if not announcement or not announcement.active:
            return {"error": "Announcement not found"}, 404

        announcement.active = False
        db.session.commit()

        return {
            "message": "Announcement deleted successfully"
        }

    except Exception as e:
        return {"error": str(e)}, 500


@app.route("/api/user/dashboard-summary")
def api_user_dashboard_summary():
    try:
        total_masses = MassRecord.query.filter_by(active=True).count()

        ai_transcriptions = MassRecord.query.filter(
            MassRecord.active == True,
            MassRecord.status == "Transcribed"
        ).count()

        sermon_summaries = MassRecord.query.filter(
            MassRecord.active == True,
            MassRecord.summary_text != None,
            MassRecord.summary_text != ""
        ).count()

        this_month_uploads = MassRecord.query.filter_by(active=True).count()

        recent_masses = MassRecord.query.filter_by(active=True).order_by(
            MassRecord.id.desc()
        ).limit(4).all()

        announcements = Announcement.query.filter_by(active=True).order_by(
            Announcement.id.desc()
        ).limit(3).all()

        latest_transcription = MassRecord.query.filter(
            MassRecord.active == True,
            MassRecord.status == "Transcribed"
        ).order_by(MassRecord.id.desc()).first()

        return {
            "stats": {
                "totalArchivedMasses": total_masses,
                "aiTranscriptions": ai_transcriptions,
                "sermonSummaries": sermon_summaries,
                "thisMonthUploads": this_month_uploads
            },
            "recentMasses": [
                {
                    "id": m.id,
                    "title": m.title,
                    "priest": m.priest,
                    "category": m.category,
                    "date": m.mass_date,
                    "duration": m.duration,
                    "status": m.status,
                    "filepath": m.filepath,
                    "hasTranscript": bool(m.transcript_text or m.summary_text)
                }
                for m in recent_masses
            ],
            "announcements": [
                {
                    "id": a.id,
                    "title": a.title,
                    "category": a.category,
                    "date": a.announcement_date,
                    "body": a.body
                }
                for a in announcements
            ],
            "latestTranscription": {
                "id": latest_transcription.id,
                "massTitle": latest_transcription.title,
                "summaryText": latest_transcription.summary_text
            } if latest_transcription else None
        }

    except Exception as e:
        return {"error": str(e)}, 500

@app.route("/api/masses/<int:mass_id>/transcribe-ai", methods=["POST"])
def api_transcribe_mass_ai(mass_id):
    try:
        mass = MassRecord.query.get(mass_id)

        if not mass or not mass.active:
            return {"error": "Mass record not found"}, 404

        if not mass.filepath:
            return {"error": "This mass has no uploaded audio/video file"}, 400

        original_path = mass.filepath

        if not os.path.exists(original_path):
            return {"error": f"Uploaded file not found: {original_path}"}, 404

        mass.status = "In Progress"
        db.session.commit()

        wav_path = original_path + ".wav"

        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i", original_path,
                "-ar", "16000",
                "-ac", "1",
                wav_path,
            ],
            check=True
        )

        segments, info = model.transcribe(
            wav_path,
            language="en",
            beam_size=1
        )

        raw_text = " ".join([seg.text for seg in segments])
        formatted = format_text(raw_text)
        highlight = highlight_best(formatted)

        safe_title = mass.title.replace(" ", "_").replace("/", "_")
        pdf_filename = f"mass_{mass.id}_{safe_title}_transcript.pdf"
        pdf_path = os.path.join(TRANSCRIPTION_FOLDER, pdf_filename)

        create_pdf(formatted, highlight, pdf_path)

        mass.transcript_text = formatted
        mass.summary_text = highlight
        mass.transcript_filename = pdf_filename
        mass.transcript_filepath = pdf_path
        mass.status = "Transcribed"

        db.session.commit()

        log = AuditLog(
            user="AI Transcription",
            action=f"AI transcribed mass #{mass.id}: {mass.title}",
            document_id=None
        )

        db.session.add(log)
        db.session.commit()

        return {
            "message": "AI transcription completed successfully",
            "mass": {
                "id": mass.id,
                "title": mass.title,
                "status": mass.status,
                "transcriptText": mass.transcript_text,
                "summaryText": mass.summary_text,
                "transcriptFilename": mass.transcript_filename,
                "transcriptFilepath": mass.transcript_filepath
            }
        }

    except subprocess.CalledProcessError as e:
        return {"error": "FFmpeg conversion failed. Check if FFmpeg is installed and the file is valid."}, 500

    except Exception as e:
        return {"error": str(e)}, 500

if __name__ == "__main__":
    app.run(debug=True)