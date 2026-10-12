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

    file_hash = db.Column(db.String(200), nullable=True)
    department = db.Column(db.String(100), nullable=True)
    ocr_text = db.Column(db.Text, nullable=True)
    extracted_metadata = db.Column(db.Text, nullable=True)

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

    # REAL OWNER OF THE REQUEST
    requester_user_id = db.Column(
        db.Integer,
        nullable=True,
        index=True
    )

    requester_name = db.Column(
        db.String(200),
        nullable=False
    )

    requester_email = db.Column(
        db.String(200)
    )

    contact_number = db.Column(
        db.String(100)
    )

    requester_address = db.Column(
        db.String(500)
    )

    sacrament_type = db.Column(
        db.String(100),
        nullable=False
    )

    person_name = db.Column(
        db.String(200),
        nullable=False
    )

    purpose = db.Column(
        db.String(300)
    )

    record_date_hint = db.Column(db.String(100), nullable=True)
    record_details = db.Column(db.String(500), nullable=True)

    # REGULAR / URGENT
    is_urgent = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    # DEMO PAYMENT VALUES
    # Stored as whole Philippine pesos for now.
    base_fee = db.Column(
        db.Integer,
        default=0,
        nullable=False
    )

    urgent_fee = db.Column(
        db.Integer,
        default=0,
        nullable=False
    )

    total_fee = db.Column(
        db.Integer,
        default=0,
        nullable=False
    )

    payment_status = db.Column(
        db.String(30),
        default="Unpaid",
        nullable=False
    )

    payment_method = db.Column(
        db.String(50),
        nullable=True
    )

    payment_reference = db.Column(
        db.String(100),
        nullable=True
    )

    paid_at = db.Column(
        db.DateTime,
        nullable=True
    )

    # REQUEST PROCESSING
    status = db.Column(
        db.String(50),
        default="Pending"
    )

    remarks = db.Column(
        db.String(500)
    )

    matched_document_id = db.Column(
        db.Integer,
        nullable=True
    )

    generated_file = db.Column(
        db.String(500),
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

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