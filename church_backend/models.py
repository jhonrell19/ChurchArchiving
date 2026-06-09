from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Document(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    person_name = db.Column(db.String(200))
    sacrament_type = db.Column(db.String(100))
    parish = db.Column(db.String(200))
    priest = db.Column(db.String(200))
    date_of_record = db.Column(db.String(100))

    book_number = db.Column(db.String(100))
    page_number = db.Column(db.String(100))
    certificate_number = db.Column(db.String(100))
    document_type = db.Column(db.String(100))

    filename = db.Column(db.String(300))
    filepath = db.Column(db.String(500))

    uploaded_by = db.Column(db.String(100))
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class AuditLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    user = db.Column(db.String(100))
    action = db.Column(db.String(500))
    document_id = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class CertificateRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    requester_name = db.Column(db.String(200), nullable=False)
    requester_email = db.Column(db.String(200))
    contact_number = db.Column(db.String(100))

    sacrament_type = db.Column(db.String(100), nullable=False)
    person_name = db.Column(db.String(200), nullable=False)
    purpose = db.Column(db.String(300))

    status = db.Column(db.String(50), default="Pending")
    remarks = db.Column(db.String(500))

    matched_document_id = db.Column(db.Integer, nullable=True)
    generated_file = db.Column(db.String(500), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class MassRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    title = db.Column(db.String(300), nullable=False)
    priest = db.Column(db.String(200))
    category = db.Column(db.String(100))
    mass_date = db.Column(db.String(100))
    duration = db.Column(db.String(100))

    status = db.Column(db.String(50), default="Pending")

    filename = db.Column(db.String(300))
    filepath = db.Column(db.String(500))

    transcript_text = db.Column(db.Text)
    summary_text = db.Column(db.Text)
    transcript_filename = db.Column(db.String(300))
    transcript_filepath = db.Column(db.String(500))

    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Announcement(db.Model):
    id = db.Column(db.Integer, primary_key=True)

    title = db.Column(db.String(300), nullable=False)
    category = db.Column(db.String(100))
    announcement_date = db.Column(db.String(100))
    body = db.Column(db.Text, nullable=False)

    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)