from flask import (

    Flask,

    render_template,

    request,

    redirect,

    send_from_directory,

    jsonify,

    g,

)

from datetime import datetime

from docxtpl import DocxTemplate

from models import (
    db,
    Document,
    AuditLog,
    CertificateRequest,
    MassRecord,
    Announcement,
    CemeterySlot,
    CemeteryReservation,
    CemeteryPayment,
    BurialRecord,
)
from document_templates import generate_official_draft, TemplateNotConfiguredError, TemplateDataError

from faster_whisper import WhisperModel

from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

from reportlab.lib.styles import getSampleStyleSheet

from werkzeug.utils import secure_filename

import subprocess
import threading

import os
import posixpath
import json
import re
from collections import Counter

from sqlalchemy import func, text
from dotenv import load_dotenv



BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)

load_dotenv(os.path.join(PROJECT_ROOT, ".env"))



app = Flask(__name__)

# Use one deterministic archive database path in development.  A relative
# SQLite URI can be surprisingly easy to point at the wrong instance folder
# when the backend is started in different ways, so resolve it explicitly.
ARCHIVE_DB_PATH = os.path.join(BACKEND_DIR, "instance", "archive.db")
os.makedirs(os.path.dirname(ARCHIVE_DB_PATH), exist_ok=True)

_archive_db_override = os.environ.get("ARCHIVE_DATABASE_URL")
if _archive_db_override:
    app.config["SQLALCHEMY_DATABASE_URI"] = _archive_db_override
else:
    app.config["SQLALCHEMY_DATABASE_URI"] = (
        "sqlite:///" + ARCHIVE_DB_PATH.replace("\\", "/")
    )

app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "dev-only-change-me")

INTERNAL_API_KEY = os.environ.get("FLASK_INTERNAL_KEY")



MASS_UPLOAD_FOLDER = os.path.join(BACKEND_DIR, "uploads", "masses")

TRANSCRIPTION_FOLDER = os.path.join(BACKEND_DIR, "uploads", "transcriptions")
CEMETERY_UPLOAD_FOLDER = os.path.join(BACKEND_DIR, "uploads", "cemetery")



os.makedirs(MASS_UPLOAD_FOLDER, exist_ok=True)

os.makedirs(TRANSCRIPTION_FOLDER, exist_ok=True)
os.makedirs(CEMETERY_UPLOAD_FOLDER, exist_ok=True)



_whisper_model = None
_whisper_model_lock = threading.Lock()


def get_whisper_model():
    """Load Faster-Whisper only when AI transcription is actually requested.

    Keeping model initialization out of module startup allows the Flask API to
    start even when the AI model needs extra time to initialize or download.
    """
    global _whisper_model

    if _whisper_model is None:
        with _whisper_model_lock:
            if _whisper_model is None:
                app.logger.info("Loading Faster-Whisper base model...")
                _whisper_model = WhisperModel(
                    "base",
                    device="cpu",
                    compute_type="int8",
                )
                app.logger.info("Faster-Whisper model loaded.")

    return _whisper_model



db.init_app(app)


REQUEST_SCHEMA_COLUMNS = {
    "requester_user_id": "INTEGER",
    "requester_address": "VARCHAR(500)",
    "is_urgent": "BOOLEAN NOT NULL DEFAULT 0",
    "base_fee": "INTEGER NOT NULL DEFAULT 0",
    "urgent_fee": "INTEGER NOT NULL DEFAULT 0",
    "total_fee": "INTEGER NOT NULL DEFAULT 0",
    "payment_status": "VARCHAR(30) NOT NULL DEFAULT 'Unpaid'",
    "payment_method": "VARCHAR(50)",
    "payment_reference": "VARCHAR(100)",
    "paid_at": "DATETIME",
    "record_date_hint": "VARCHAR(100)",
    "record_details": "VARCHAR(500)",
    "draft_file": "VARCHAR(500)",
}

DOCUMENT_SCHEMA_COLUMNS = {
    "file_hash": "VARCHAR(200)",
    "department": "VARCHAR(100)",
    "ocr_text": "TEXT",
    "extracted_metadata": "TEXT",
    "record_data": "TEXT",
}


def ensure_runtime_schema():
    """Bring the SQLite schema used by *this Flask process* up to date.

    This is intentionally idempotent.  It prevents a restored/older
    archive.db from being opened by the app with models that expect newer
    columns.  It also eliminates ambiguity about which archive.db was
    migrated because the ALTER statements run through Flask-SQLAlchemy's
    own engine.
    """

    def column_names(connection, table_name):
        rows = connection.execute(
            text(f"PRAGMA table_info({table_name})")
        ).fetchall()
        return {row[1] for row in rows}

    with db.engine.begin() as connection:
        for table_name, required_columns in (
            ("certificate_request", REQUEST_SCHEMA_COLUMNS),
            ("document", DOCUMENT_SCHEMA_COLUMNS),
        ):
            existing = column_names(connection, table_name)

            for column_name, definition in required_columns.items():
                if column_name not in existing:
                    app.logger.warning(
                        "Adding missing database column %s.%s",
                        table_name,
                        column_name,
                    )
                    connection.execute(
                        text(
                            f"ALTER TABLE {table_name} "
                            f"ADD COLUMN {column_name} {definition}"
                        )
                    )

        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS "
                "ix_certificate_request_requester_user_id "
                "ON certificate_request(requester_user_id)"
            )
        )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_document_file_hash "
                "ON document(file_hash)"
            )
        )

        # Keep records created by the older prototype visible in the new
        # Burial Admin category.
        connection.execute(
            text(
                "UPDATE document SET sacrament_type = 'burial' "
                "WHERE sacrament_type = 'death'"
            )
        )
        connection.execute(
            text(
                "UPDATE certificate_request SET sacrament_type = 'burial' "
                "WHERE sacrament_type = 'death'"
            )
        )

        connection.execute(
            text(
                """
                UPDATE certificate_request
                SET generated_file = NULL,
                    status = CASE WHEN status = 'Ready' THEN 'Approved' ELSE status END
                WHERE matched_document_id IS NOT NULL
                  AND generated_file IS NOT NULL
                  AND REPLACE(generated_file, '\\', '/') = (
                      SELECT REPLACE(document.filepath, '\\', '/')
                      FROM document
                      WHERE document.id = certificate_request.matched_document_id
                  )
                  AND REPLACE(generated_file, '\\', '/') NOT LIKE 'uploads/releases/%'
                """
            )
        )

        connection.execute(
            text(
                """
                UPDATE certificate_request
                SET status = CASE
                    WHEN matched_document_id IS NOT NULL THEN 'Approved'
                    ELSE 'Pending'
                END
                WHERE status = 'Released'
                  AND (payment_status != 'Paid' OR generated_file IS NULL)
                """
            )
        )

        connection.execute(
            text(
                """
                UPDATE document
                SET department = 'main'
                WHERE sacrament_type IN ('baptismal', 'confirmation', 'marriage')
                  AND (department IS NULL OR TRIM(department) = '')
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE document
                SET department = 'burial'
                WHERE sacrament_type IN ('burial', 'land_agreement')
                  AND (department IS NULL OR TRIM(department) = '')
                """
            )
        )

    # Drop any pooled SQLite connection that may have cached the old schema
    # before the ALTER TABLE statements.  All request handlers will open a
    # fresh connection after this point.
    db.session.remove()
    db.engine.dispose()

    with db.engine.connect() as connection:
        request_columns = column_names(connection, "certificate_request")
        missing = set(REQUEST_SCHEMA_COLUMNS) - request_columns
        if missing:
            raise RuntimeError(
                "Archive database migration failed. Missing columns: "
                + ", ".join(sorted(missing))
            )

        # Execute the exact column access that previously failed so startup
        # stops immediately if Flask is somehow pointed at the wrong file.
        connection.execute(
            text(
                "SELECT requester_user_id "
                "FROM certificate_request LIMIT 1"
            )
        ).fetchall()


with app.app_context():
    db.create_all()
    ensure_runtime_schema()
    print(f"[Smart Parish] Archive DB: {db.engine.url.database}")
    print("[Smart Parish] Request schema verified: requester_user_id OK")


MAIN_ADMIN_TYPES = ["baptismal", "confirmation", "marriage"]

BURIAL_ADMIN_TYPES = ["burial", "land_agreement", "ownership"]



PREFIX_MAP = {

    "baptismal": "BAP",

    "confirmation": "CNF",

    "marriage": "MRG",

    "burial": "BRL",

    "land_agreement": "LAG",
    "ownership": "OWN",

}

# PAYMONGO_CERTIFICATE_V1
# All prices are in whole PHP pesos. Unconfirmed document prices default to 0 (disabled).
CERTIFICATE_BASE_FEES = {
    "baptismal": int(os.getenv("CERT_FEE_BAPTISMAL", "200")),
    "confirmation": int(os.getenv("CERT_FEE_CONFIRMATION", "200")),
    "marriage": int(os.getenv("CERT_FEE_MARRIAGE", "0")),
    "ownership": int(os.getenv("CERT_FEE_OWNERSHIP", "0")),
    "land_agreement": int(os.getenv("CERT_FEE_LAND_AGREEMENT", "0")),
}
DEMO_BASE_FEES = CERTIFICATE_BASE_FEES
DEMO_URGENT_FEE = int(os.getenv("CERT_FEE_URGENT", "100"))



def current_user_id():

    try:

        return int(g.user_id)

    except (TypeError, ValueError):

        return None



def serialize_request(r):
    matched_document = None

    if r.matched_document_id:
        source = db.session.get(Document, r.matched_document_id)
        if source:
            matched_document = {
                "id": source.id,
                "personName": source.person_name,
                "sacramentType": source.sacrament_type,
                "dateOfRecord": source.date_of_record,
                "bookNumber": source.book_number,
                "pageNumber": source.page_number,
                "certificateNumber": source.certificate_number,
                "filename": source.filename,
                "filepath": source.filepath,
                "recordData": json.loads(source.record_data) if source.record_data else {},
            }

    return {

        "id": r.id,



        "requesterUserId":

            r.requester_user_id,



        "requesterName":

            r.requester_name,



        "requesterEmail":

            r.requester_email,



        "contactNumber":

            r.contact_number,



        "requesterAddress":

            r.requester_address,



        "sacramentType":

            r.sacrament_type,



        "personName":

            r.person_name,



        "purpose":

            r.purpose,

        "recordDateHint": r.record_date_hint,

        "recordDetails": r.record_details,

        "isUrgent":

            bool(r.is_urgent),



        "baseFee":

            r.base_fee,



        "urgentFee":

            r.urgent_fee,



        "totalFee":

            r.total_fee,



        "paymentStatus":

            r.payment_status,



        "paymentMethod":

            r.payment_method,



        "paymentReference":

            r.payment_reference,



        "paidAt":

            r.paid_at.isoformat()

            if r.paid_at

            else None,



        "status":

            r.status,



        "remarks":

            r.remarks,



        "matchedDocumentId":

            r.matched_document_id,



        "matchedDocument":

            matched_document,



        "draftFile":

            r.draft_file,



        "generatedFile":

            r.generated_file,



        "createdAt":

            r.created_at.isoformat()

            if r.created_at

            else None,



        "updatedAt":

            r.updated_at.isoformat()

            if r.updated_at

            else None,

    }



def _is_protected_backend_path():

    return (

        request.path.startswith("/api/")

        or request.path.startswith("/files/")

        or request.path.startswith("/download/")

    )





@app.before_request

def protect_backend_boundary():

    # Only the modern API/file endpoints may be served by Flask.
    # Old HTML admin and generated-file routes are deliberately disabled.
    if not _is_protected_backend_path():
        return {"error": "Not found"}, 404



    if not INTERNAL_API_KEY:

        app.logger.error("FLASK_INTERNAL_KEY is not configured")

        return {"error": "Backend security is not configured"}, 500



    if request.headers.get("X-Internal-Key") != INTERNAL_API_KEY:

        return {"error": "Unauthorized"}, 401



    g.user_id = request.headers.get("X-User-Id")

    g.user_role = request.headers.get("X-User-Role")

    g.user_email = request.headers.get("X-User-Email")

    g.user_name = request.headers.get("X-User-Name")

    g.user_phone = request.headers.get("X-User-Phone")



    g.user_address = request.headers.get("X-User-Address")



    if request.path == "/api/paymongo/confirm-internal" and g.user_role == "PAYMONGO_WEBHOOK":
        return None

    if g.user_role not in {"USER", "ADMIN", "BURIAL_ADMIN"}:

        return {"error": "Invalid authenticated role"}, 401



    return None





def require_roles(*roles):

    if getattr(g, "user_role", None) not in roles:

        return {"error": "Forbidden"}, 403

    return None





def allowed_types_for_current_role():

    role = getattr(g, "user_role", None)

    if role == "ADMIN":

        return MAIN_ADMIN_TYPES

    if role == "BURIAL_ADMIN":

        return BURIAL_ADMIN_TYPES

    if role == "USER":

        return MAIN_ADMIN_TYPES + BURIAL_ADMIN_TYPES

    return []





def staff_can_access_request(cert_request):

    return cert_request.sacrament_type in allowed_types_for_current_role()





def normalize_path(filepath):

    raw = (filepath or "").replace("\\", "/").strip()

    # Collapse duplicate separators and traversal segments such as ../.
    return posixpath.normpath("/" + raw).lstrip("/")


def backend_storage_path(filepath):

    normalized = normalize_path(filepath)

    return os.path.join(
        BACKEND_DIR,
        *normalized.split("/")
    )


def can_access_filepath(filepath):

    role = getattr(g, "user_role", None)

    normalized = normalize_path(filepath)

    if not normalized or normalized == ".":
        return False

    # Historical Windows records can contain backslashes in SQLite.
    document_path_matches = (
        func.replace(Document.filepath, "\\", "/") == normalized
    )

    request_path_matches = (
        func.replace(CertificateRequest.generated_file, "\\", "/") == normalized
    )

    draft_path_matches = (
        func.replace(CertificateRequest.draft_file, "\\", "/") == normalized
    )

    # MAIN ADMIN
    if role == "ADMIN":

        if (
            normalized.startswith("uploads/masses/")
            or normalized.startswith("uploads/transcriptions/")
        ):
            return True

        document = (
            Document.query
            .filter(document_path_matches)
            .first()
        )

        if document and document.sacrament_type in MAIN_ADMIN_TYPES:
            return True

        release_request = (
            CertificateRequest.query
            .filter(
                request_path_matches,
                CertificateRequest.sacrament_type.in_(MAIN_ADMIN_TYPES),
            )
            .first()
        )

        if release_request is not None:
            return True

        draft_request = (
            CertificateRequest.query
            .filter(
                draft_path_matches,
                CertificateRequest.sacrament_type.in_(MAIN_ADMIN_TYPES),
            )
            .first()
        )

        return draft_request is not None

    # BURIAL ADMIN
    if role == "BURIAL_ADMIN":

        document = (
            Document.query
            .filter(document_path_matches)
            .first()
        )

        if document and document.sacrament_type in BURIAL_ADMIN_TYPES:
            return True

        release_request = (
            CertificateRequest.query
            .filter(
                request_path_matches,
                CertificateRequest.sacrament_type.in_(BURIAL_ADMIN_TYPES),
            )
            .first()
        )

        if release_request is not None:
            return True

        draft_request = (
            CertificateRequest.query
            .filter(
                draft_path_matches,
                CertificateRequest.sacrament_type.in_(BURIAL_ADMIN_TYPES),
            )
            .first()
        )

        return draft_request is not None

    # PARISHIONER / USER
    if role == "USER":

        user_id = current_user_id()

        if not user_id:
            return False

        # Users may view public parish Mass media/transcript files, but never
        # sacramental archive source scans.
        mass_file_match = (
            MassRecord.query
            .filter(
                MassRecord.active == True,
                (func.replace(MassRecord.filepath, "\\", "/") == normalized)
                | (func.replace(MassRecord.transcript_filepath, "\\", "/") == normalized),
            )
            .first()
        )
        if mass_file_match:
            return True

        # Final certificate downloads remain private to the request owner and
        # are available only after payment and release.
        owned_request = (
            CertificateRequest.query
            .filter(
                CertificateRequest.requester_user_id == user_id,
                request_path_matches,
                CertificateRequest.status == "Released",
                CertificateRequest.payment_status == "Paid",
            )
            .first()
        )

        return owned_request is not None

    return False


def get_department(sacrament_type):

    if sacrament_type in BURIAL_ADMIN_TYPES:

        return "burial"

    return "main"



def get_allowed_types(scope):

    if scope == "burial":

        return BURIAL_ADMIN_TYPES

    if scope == "main":

        return MAIN_ADMIN_TYPES

    return MAIN_ADMIN_TYPES + BURIAL_ADMIN_TYPES



def calculate_file_hash(file):

    import hashlib



    hasher = hashlib.sha256()



    file.stream.seek(0)



    while True:

        chunk = file.stream.read(8192)

        if not chunk:

            break

        hasher.update(chunk)



    file.stream.seek(0)



    return hasher.hexdigest()






def extract_text_from_path(file_path):
    """Extract OCR text from image/PDF files when optional OCR tools exist.

    Requires pytesseract + Pillow. PDF OCR also uses PyMuPDF. The function
    deliberately raises a readable RuntimeError when the local OCR engine is
    not installed so the archive workflow can continue without silently
    pretending OCR succeeded.
    """
    try:
        import pytesseract
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError(
            "OCR Python packages are not installed. Run: pip install pytesseract Pillow PyMuPDF"
        ) from exc

    extension = os.path.splitext(file_path)[1].lower()
    texts = []

    if extension in {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}:
        try:
            texts.append(pytesseract.image_to_string(Image.open(file_path)))
        except pytesseract.TesseractNotFoundError as exc:
            raise RuntimeError(
                "Tesseract OCR is not installed or not available on PATH."
            ) from exc
    elif extension == ".pdf":
        try:
            import fitz
        except ImportError as exc:
            raise RuntimeError("PDF OCR requires PyMuPDF. Run: pip install PyMuPDF") from exc

        document = fitz.open(file_path)
        try:
            for page_index in range(min(len(document), 10)):
                page = document.load_page(page_index)
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                texts.append(pytesseract.image_to_string(image))
        finally:
            document.close()
    else:
        raise RuntimeError("OCR supports PDF, JPG, JPEG, PNG, BMP, and TIFF files.")

    return "\n".join(part.strip() for part in texts if part and part.strip()).strip()


def infer_archive_metadata_from_ocr(text_value):
    """Return conservative metadata suggestions from OCR text.

    Suggestions never overwrite staff-entered values automatically; the admin
    remains responsible for verification because church scans can contain OCR
    mistakes.
    """
    text_value = text_value or ""
    lines = [line.strip() for line in text_value.splitlines() if line.strip()]
    result = {}

    certificate_match = re.search(
        r"(?:certificate|cert(?:ificate)?\s*no\.?|no\.)\s*[:#-]?\s*([A-Z0-9-]{4,30})",
        text_value,
        flags=re.IGNORECASE,
    )
    if certificate_match:
        result["certificateNumber"] = certificate_match.group(1).strip()

    date_match = re.search(
        r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b",
        text_value,
    )
    if date_match:
        result["dateHint"] = date_match.group(1)

    if lines:
        # A name suggestion is intentionally only a hint. Avoid lines that look
        # like headings, numbers, or very long sentences.
        for line in lines[:12]:
            if 3 <= len(line) <= 80 and not any(ch.isdigit() for ch in line):
                if not re.search(r"certificate|church|parish|baptism|marriage|confirmation|burial", line, re.I):
                    result["possibleName"] = line
                    break

    return result


def summarize_transcript(text_value, max_sentences=4):
    """Create a deterministic extractive summary from a transcript.

    This is intentionally lightweight and local. It scores sentences using
    meaningful-word frequency instead of the previous "longest sentence"
    shortcut, which produced poor summaries.
    """
    clean = re.sub(r"\s+", " ", (text_value or "")).strip()
    if not clean:
        return ""

    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", clean) if s.strip()]
    if len(sentences) <= max_sentences:
        return " ".join(sentences)

    stop = {
        "the", "a", "an", "and", "or", "but", "to", "of", "in", "on", "for", "with",
        "is", "are", "was", "were", "be", "been", "being", "this", "that", "these",
        "those", "it", "its", "as", "at", "by", "from", "we", "you", "they", "he",
        "she", "i", "our", "your", "their", "so", "if", "then", "than", "not",
    }
    words = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿÑñ']+", clean.lower())
    frequencies = Counter(word for word in words if len(word) > 2 and word not in stop)
    if not frequencies:
        return " ".join(sentences[:max_sentences])

    scored = []
    for index, sentence in enumerate(sentences):
        sentence_words = re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿÑñ']+", sentence.lower())
        score = sum(frequencies.get(word, 0) for word in sentence_words)
        score = score / max(len(sentence_words), 1)
        scored.append((score, index, sentence))

    selected = sorted(scored, reverse=True)[:max_sentences]
    selected.sort(key=lambda item: item[1])
    return " ".join(sentence for _, _, sentence in selected)


def generate_release_pdf(cert_request, source_document, output_path):
    """Generate a clean draft release PDF from the verified archive record.

    The parish can later replace this layout with its official signed/sealed
    template without changing the request workflow.
    """
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(output_path)
    story = [
        Paragraph("<b>Iglesia Filipina Independiente - Maragondon</b>", styles["Title"]),
        Spacer(1, 14),
        Paragraph("<b>System-Generated Certificate Draft</b>", styles["Heading2"]),
        Paragraph(
            "This document is generated from a verified parish archive record. "
            "It must be reviewed, signed, and/or sealed according to parish policy before official use.",
            styles["BodyText"],
        ),
        Spacer(1, 16),
        Paragraph(f"<b>Document Type:</b> {source_document.sacrament_type.replace('_', ' ').title()}", styles["BodyText"]),
        Paragraph(f"<b>Name on Record:</b> {source_document.person_name or cert_request.person_name}", styles["BodyText"]),
        Paragraph(f"<b>Date of Record:</b> {source_document.date_of_record or 'Not recorded'}", styles["BodyText"]),
        Paragraph(f"<b>Certificate Number:</b> {source_document.certificate_number or 'Not recorded'}", styles["BodyText"]),
        Paragraph(f"<b>Parish:</b> {source_document.parish or 'IFI Maragondon'}", styles["BodyText"]),
        Paragraph(f"<b>Priest:</b> {source_document.priest or 'Not recorded'}", styles["BodyText"]),
        Spacer(1, 18),
        Paragraph(f"<b>Request Reference:</b> IFI-REQ-{cert_request.id:04d}", styles["BodyText"]),
        Paragraph(f"<b>Requested by:</b> {cert_request.requester_name}", styles["BodyText"]),
        Paragraph(f"<b>Purpose:</b> {cert_request.purpose or 'Not specified'}", styles["BodyText"]),
    ]
    doc.build(story)


def highlight_best(text):
    # Backward-compatible helper name; now returns a meaningful extractive summary.
    return summarize_transcript(text, max_sentences=4)





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



    content.append(Paragraph("<b>Extractive Summary:</b>", styles["Heading2"]))

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

        physical_folder = backend_storage_path(folder)

        os.makedirs(physical_folder, exist_ok=True)



        safe_filename = secure_filename(file.filename)

        if not safe_filename:

            return "Invalid filename", 400

        filepath = f"{folder}/{safe_filename}"

        file.save(backend_storage_path(filepath))



        new_document = Document(

            person_name=person_name,

            sacrament_type=sacrament_type,

            parish=parish,

            priest=priest,

            date_of_record=date_of_record,

            filename=safe_filename,

            filepath=filepath,

            uploaded_by=getattr(g, "user_email", None) or "Admin"

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



        os.makedirs(os.path.join(BACKEND_DIR, "generated"), exist_ok=True)



        doc = DocxTemplate(

            os.path.join(BACKEND_DIR, "templates", "certificates", "baptismal_template.docx")

        )



        doc.render(data)



        safe_name = data["Full_Name"].replace(" ", "_")



        output_filename = f"{safe_name}_Baptismal.docx"

        output_docx = os.path.join(BACKEND_DIR, "generated", output_filename)



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

        os.path.join(BACKEND_DIR, "generated"),

        filename,

        as_attachment=True

    )





@app.route("/files/<path:filepath>")

def view_file(filepath):

    if not can_access_filepath(filepath):

        return {"error": "Forbidden"}, 403

    return send_from_directory(

        BACKEND_DIR,

        normalize_path(filepath),

        as_attachment=False

    )



@app.route("/api/archive/ocr-preview", methods=["POST"])
def api_archive_ocr_preview():
    denied = require_roles("ADMIN", "BURIAL_ADMIN")
    if denied:
        return denied

    file = request.files.get("file")
    if not file or not file.filename:
        return {"error": "Choose a scanned PDF or image first."}, 400

    filename = secure_filename(file.filename)
    extension = os.path.splitext(filename)[1].lower()
    if extension not in {".pdf", ".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}:
        return {"error": "OCR supports PDF and common image files."}, 400

    preview_folder = os.path.join(BACKEND_DIR, "uploads", "ocr_preview")
    os.makedirs(preview_folder, exist_ok=True)
    temp_path = os.path.join(preview_folder, f"preview_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}{extension}")

    try:
        file.save(temp_path)
        text_value = extract_text_from_path(temp_path)
        return {
            "text": text_value,
            "suggestions": infer_archive_metadata_from_ocr(text_value),
        }, 200
    except RuntimeError as error:
        return {"error": str(error)}, 503
    finally:
        try:
            if os.path.isfile(temp_path):
                os.remove(temp_path)
        except OSError:
            pass


@app.route("/api/health")
def api_health():
    try:
        db.session.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "database": "ok",
            "whisperLoaded": _whisper_model is not None,
        }, 200
    except Exception as error:
        return {"status": "error", "error": str(error)}, 500


@app.route("/api/archive/upload", methods=["POST"])
def api_upload_document():

    denied = require_roles("ADMIN", "BURIAL_ADMIN")

    if denied:

        return denied

    try:

        file = request.files.get("file")



        if not file:

            return {"error": "No file uploaded"}, 400



        person_name = request.form.get("person_name")

        sacrament_type = request.form.get("sacrament_type")

        parish = request.form.get("parish")

        priest = request.form.get("priest")

        date_of_record = request.form.get("date_of_record")
        book_number = (request.form.get("book_number") or "").strip() or None
        page_number = (request.form.get("page_number") or "").strip() or None

        document_type = request.form.get("document_type")
        run_ocr = (request.form.get("runOcr") or "").lower() in {"1", "true", "yes", "on"}
        record_data_raw = (request.form.get("record_data") or "").strip()
        record_data = {}
        if record_data_raw:
            try:
                parsed_record_data = json.loads(record_data_raw)
            except json.JSONDecodeError:
                return {"error": "Template record data is not valid JSON."}, 400
            if not isinstance(parsed_record_data, dict):
                return {"error": "Template record data must be a JSON object."}, 400
            record_data = parsed_record_data



        if not person_name or not sacrament_type:

            return {"error": "Person name and document type are required"}, 400



        allowed_types = allowed_types_for_current_role()



        if sacrament_type not in allowed_types:

            return {"error": "Invalid document category"}, 400

        if sacrament_type == "burial":
            return {"error": "New burial certificate archives are retired. Use Certificate of Ownership for the appropriate document instead."}, 400



        file_hash = calculate_file_hash(file)



        duplicate_file = Document.query.filter_by(

            file_hash=file_hash,

            active=True

        ).first()



        if duplicate_file:

            return {

                "error": f"Duplicate file detected. This file already exists as {duplicate_file.certificate_number or 'Archive ID ' + str(duplicate_file.id)}."

            }, 409



        possible_duplicate = Document.query.filter(

            Document.active == True,

            Document.sacrament_type == sacrament_type,

            Document.person_name.ilike(person_name),

            Document.date_of_record == date_of_record

        ).first()



        if possible_duplicate:

            return {

                "error": f"Possible duplicate record found: {possible_duplicate.person_name} ({possible_duplicate.certificate_number or 'Archive ID ' + str(possible_duplicate.id)}). Please review the existing record first."

            }, 409



        prefix = PREFIX_MAP.get(sacrament_type, "DOC")

        year = date_of_record[:4] if date_of_record else "2026"



        existing_count = Document.query.filter(

            Document.active == True,

            Document.sacrament_type == sacrament_type,

            Document.certificate_number.like(f"{prefix}-{year}-%")

        ).count()



        next_number = existing_count + 1

        certificate_number = f"{prefix}-{year}-{next_number:03d}"



        department = get_department(sacrament_type)



        relative_folder = f"uploads/{sacrament_type}"

        upload_folder = backend_storage_path(relative_folder)

        os.makedirs(upload_folder, exist_ok=True)



        filename = secure_filename(file.filename)

        if not filename:

            return {"error": "Invalid filename"}, 400

        filepath = f"{relative_folder}/{filename}"

        physical_filepath = backend_storage_path(filepath)



        file.save(physical_filepath)

        ocr_text = None
        extracted_metadata = None
        if run_ocr:
            try:
                ocr_text = extract_text_from_path(physical_filepath)
                extracted_metadata = json.dumps(
                    infer_archive_metadata_from_ocr(ocr_text),
                    ensure_ascii=False,
                )
            except RuntimeError as ocr_error:
                app.logger.warning("OCR skipped for %s: %s", filename, ocr_error)

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

            file_hash=file_hash,

            department=department,
            ocr_text=ocr_text,
            extracted_metadata=extracted_metadata,
            record_data=json.dumps(record_data, ensure_ascii=False) if record_data else None,

            uploaded_by=getattr(g, "user_email", None) or "Admin"

        )



        db.session.add(new_document)

        db.session.commit()



        log = AuditLog(

            user=getattr(g, "user_email", None) or "Admin",

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

                "department": new_document.department,

                "filename": new_document.filename,

                "filepath": new_document.filepath,
                "ocrAvailable": bool(new_document.ocr_text),
                "ocrSuggestions": json.loads(new_document.extracted_metadata) if new_document.extracted_metadata else {},
                "recordData": json.loads(new_document.record_data) if new_document.record_data else {}

            }

        }, 201



    except Exception as e:

        return {"error": str(e)}, 500



@app.route("/api/archive/stats")

def api_archive_stats():

    denied = require_roles("ADMIN", "BURIAL_ADMIN")

    if denied:

        return denied



    allowed_types = allowed_types_for_current_role()

    base = Document.query.filter(

        Document.active == True,

        Document.sacrament_type.in_(allowed_types)

    )



    def count_type(name):

        if name not in allowed_types:

            return 0

        return Document.query.filter_by(active=True, sacrament_type=name).count()



    return {

        "totalRecords": base.count(),

        "baptismal": count_type("baptismal"),

        "marriage": count_type("marriage"),

        "confirmation": count_type("confirmation"),

        "burial": count_type("burial"),

        "landAgreement": count_type("land_agreement"),

        "generatedCertificates": Document.query.filter(

            Document.active == True,

            Document.sacrament_type.in_(allowed_types),

            Document.uploaded_by == "User Request"

        ).count()

    }





@app.route("/api/archive/documents")

def api_archive_documents():

    denied = require_roles("ADMIN", "BURIAL_ADMIN")

    if denied:

        return denied



    allowed_types = allowed_types_for_current_role()



    documents = Document.query.filter(

        Document.active == True,

        Document.sacrament_type.in_(allowed_types)

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

                "department": d.department,

                "filename": d.filename,

                "filepath": d.filepath,

                "uploadedBy": d.uploaded_by,
                "ocrText": d.ocr_text,
                "ocrSuggestions": json.loads(d.extracted_metadata) if d.extracted_metadata else {},
                "recordData": json.loads(d.record_data) if d.record_data else {},

            }

            for d in documents

        ]

    }





@app.route("/api/archive/documents/<sacrament_type>")

def api_archive_documents_by_type(sacrament_type):

    denied = require_roles("ADMIN", "BURIAL_ADMIN")

    if denied:

        return denied



    if sacrament_type not in allowed_types_for_current_role():

        return {"error": "Forbidden category"}, 403



    query = Document.query.filter_by(

        active=True,

        sacrament_type=sacrament_type

    )

    search_term = (request.args.get("q") or "").strip()

    if search_term:
        query = query.filter(
            Document.person_name.ilike(f"%{search_term}%")
        )

    documents = (
        query
        .order_by(Document.person_name.asc())
        .limit(25)
        .all()
    )



    return {

        "documents": [

            {

                "id": d.id,

                "personName": d.person_name,

                "sacramentType": d.sacrament_type,

                "parish": d.parish,

                "priest": d.priest,

                "dateOfRecord": d.date_of_record,

                "bookNumber": d.book_number,

                "pageNumber": d.page_number,

                "certificateNumber": d.certificate_number,

                "documentType": d.document_type,

                "filename": d.filename,

                "filepath": d.filepath,

                "uploadedBy": d.uploaded_by,
                "ocrText": d.ocr_text,
                "ocrSuggestions": json.loads(d.extracted_metadata) if d.extracted_metadata else {},
                "recordData": json.loads(d.record_data) if d.record_data else {},

            }

            for d in documents

        ]

    }





@app.route("/api/archive/audit-logs")

def api_audit_logs():

    denied = require_roles("ADMIN")

    if denied:

        return denied

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



    denied = require_roles("USER")



    if denied:

        return denied



    try:

        data = request.get_json() or {}



        user_id = current_user_id()



        if not user_id:

            return {

                "error": "Invalid authenticated user."

            }, 401



        requester_name = (

            getattr(g, "user_name", None)

            or ""

        ).strip()



        requester_email = (

            getattr(g, "user_email", None)

            or ""

        ).strip()



        contact_number = (

            getattr(g, "user_phone", None)

            or ""

        ).strip()



        requester_address = (

            getattr(g, "user_address", None)

            or ""

        ).strip()



        sacrament_type = (

            data.get("sacramentType")

            or ""

        ).strip()



        person_name = (

            data.get("personName")

            or ""

        ).strip()



        purpose = (

            data.get("purpose")

            or ""

        ).strip()

        record_date_hint = (data.get("recordDateHint") or "").strip()[:100] or None
        record_details = (data.get("recordDetails") or "").strip()[:500] or None

        is_urgent = (

            data.get("isUrgent") is True

        )



        if not requester_name:

            return {

                "error":

                    "Your account profile is missing a name."

            }, 400



        if not person_name:

            return {

                "error":

                    "Name on record is required."

            }, 400



        if not purpose:

            return {

                "error":

                    "Request purpose is required."

            }, 400



        if sacrament_type == "burial":
            return {"error": "Burial certificate requests are no longer offered. Select Certificate of Ownership instead."}, 400

        if sacrament_type not in (

            MAIN_ADMIN_TYPES

            + BURIAL_ADMIN_TYPES

        ):

            return {

                "error":

                    "Invalid request category."

            }, 400



        base_fee = DEMO_BASE_FEES.get(

            sacrament_type,

            0

        )



        urgent_fee = (

            DEMO_URGENT_FEE

            if is_urgent

            else 0

        )



        total_fee = (

            base_fee

            + urgent_fee

        )



        new_request = CertificateRequest(

            requester_user_id=user_id,



            requester_name=requester_name,



            requester_email=requester_email,



            contact_number=contact_number,



            requester_address=requester_address,



            sacrament_type=sacrament_type,



            person_name=person_name,



            purpose=purpose,

            record_date_hint=record_date_hint,
            record_details=record_details,

            is_urgent=is_urgent,



            base_fee=base_fee,



            urgent_fee=urgent_fee,



            total_fee=total_fee,



            payment_status="Unpaid",



            status="Pending",

        )



        db.session.add(new_request)

        db.session.commit()



        priority_text = (

            "URGENT"

            if is_urgent

            else "regular"

        )



        log = AuditLog(

            user=requester_name,



            action=(

                f"Submitted {priority_text} "

                f"{sacrament_type} request "

                f"for {person_name}"

            ),



            document_id=None,

        )



        db.session.add(log)

        db.session.commit()



        return {

            "message":

                "Request submitted successfully.",



            "request":

                serialize_request(

                    new_request

                ),

        }, 201



    except Exception as e:

        db.session.rollback()



        return {

            "error": str(e)

        }, 500





@app.route("/api/requests", methods=["GET"])

def api_get_requests():



    try:

        role = getattr(

            g,

            "user_role",

            None

        )



        priority = request.args.get(

            "priority"

        )



        if role == "USER":



            user_id = current_user_id()



            if not user_id:

                return {

                    "error":

                        "Invalid authenticated user."

                }, 401



            query = (

                CertificateRequest.query

                .filter_by(

                    requester_user_id=user_id

                )

            )



        elif role in {

            "ADMIN",

            "BURIAL_ADMIN",

        }:



            query = (

                CertificateRequest.query

                .filter(

                    CertificateRequest

                    .sacrament_type

                    .in_(

                        allowed_types_for_current_role()

                    )

                )

            )



            if priority == "urgent":



                query = query.filter(

                    CertificateRequest

                    .is_urgent.is_(True)

                )



            elif priority == "regular":



                query = query.filter(

                    CertificateRequest

                    .is_urgent.is_(False)

                )



        else:



            return {

                "error": "Forbidden"

            }, 403



        requests_list = (

            query

            .order_by(

                CertificateRequest.id.desc()

            )

            .all()

        )



        return {

            "requests": [

                serialize_request(r)

                for r in requests_list

            ]

        }



    except Exception as e:



        return {

            "error": str(e)

        }, 500





@app.route("/api/requests/<int:request_id>", methods=["GET"])
def api_get_single_request(request_id):
    cert_request = db.session.get(CertificateRequest, request_id)

    if not cert_request:
        return {"error": "Request not found"}, 404

    role = getattr(g, "user_role", None)

    if role == "USER":
        user_id = current_user_id()

        if not user_id:
            return {"error": "Invalid authenticated user."}, 401

        if cert_request.requester_user_id != user_id:
            return {"error": "Forbidden"}, 403

    elif role in {"ADMIN", "BURIAL_ADMIN"}:
        if not staff_can_access_request(cert_request):
            return {"error": "Forbidden"}, 403

    else:
        return {"error": "Forbidden"}, 403

    return {
        "request": serialize_request(cert_request)
    }


@app.route("/api/requests/<int:request_id>/demo-pay", methods=["POST"])
def api_demo_pay_request(request_id):
    return {"error": "Demo payments disabled. Use PayMongo Checkout."}, 410
    denied = require_roles("USER")

    if denied:
        return denied

    try:
        cert_request = db.session.get(CertificateRequest, request_id)

        if not cert_request:
            return {"error": "Request not found."}, 404

        user_id = current_user_id()

        if not user_id:
            return {"error": "Invalid authenticated user."}, 401

        if cert_request.requester_user_id != user_id:
            return {"error": "Forbidden."}, 403

        if cert_request.status not in {"Approved", "Ready"}:
            return {
                "error": "The request must be approved before payment."
            }, 400

        if cert_request.payment_status == "Paid":
            return {
                "message": "This request is already paid.",
                "request": serialize_request(cert_request),
            }, 200

        cert_request.payment_status = "Paid"
        cert_request.payment_method = "DEMO"
        cert_request.payment_reference = f"DEMO-{cert_request.id:06d}"
        cert_request.paid_at = datetime.utcnow()

        log = AuditLog(
            user=getattr(g, "user_email", None) or "USER",
            action=f"Demo payment completed for request #{cert_request.id}",
            document_id=cert_request.matched_document_id,
        )

        db.session.add(log)
        db.session.commit()

        return {
            "message": "Demo payment completed successfully.",
            "request": serialize_request(cert_request),
        }, 200

    except Exception as e:
        db.session.rollback()
        return {"error": str(e)}, 500


@app.route("/api/requests/<int:request_id>/status", methods=["PATCH"])
def api_update_request_status(request_id):
    denied = require_roles("ADMIN", "BURIAL_ADMIN")

    if denied:
        return denied

    try:
        cert_request = db.session.get(CertificateRequest, request_id)

        if not cert_request:
            return {"error": "Request not found"}, 404

        if not staff_can_access_request(cert_request):
            return {"error": "Forbidden"}, 403

        data = request.get_json(silent=True) or {}
        status = data.get("status")
        remarks = data.get("remarks")

        allowed_statuses = {"Approved", "Rejected", "Released"}

        if status not in allowed_statuses:
            return {"error": "Invalid status transition"}, 400

        current_status = cert_request.status or "Pending"

        allowed_transitions = {
            "Pending": {"Approved", "Rejected"},
            "Approved": {"Rejected"},
            "Ready": {"Released"},
            "Rejected": set(),
            "Released": set(),
        }

        if status not in allowed_transitions.get(current_status, set()):
            return {
                "error": f"Cannot change request from {current_status} to {status}."
            }, 400

        if status == "Approved" and not cert_request.matched_document_id:
            return {
                "error": "Select and verify the matching archive record before approving this request."
            }, 400

        if status == "Rejected" and cert_request.payment_status == "Paid":
            return {
                "error": "A paid request cannot be rejected in the demo workflow."
            }, 400

        if status == "Released":
            if not cert_request.generated_file:
                return {
                    "error": "Attach the document before releasing it."
                }, 400

            if cert_request.payment_status != "Paid":
                return {
                    "error": "This document cannot be released until payment is confirmed."
                }, 400

        cert_request.status = status

        if remarks is not None:
            cert_request.remarks = remarks

        log = AuditLog(
            user=getattr(g, "user_email", None) or "Admin",
            action=f"Updated request #{cert_request.id} status to {status}",
            document_id=cert_request.matched_document_id,
        )

        db.session.add(log)
        db.session.commit()

        return {
            "message": "Request status updated successfully.",
            "request": serialize_request(cert_request),
        }, 200

    except Exception as e:
        db.session.rollback()
        return {"error": str(e)}, 500


@app.route("/api/requests/<int:request_id>/select-record", methods=["PATCH"])
@app.route("/api/requests/<int:request_id>/attach-document", methods=["PATCH"])
def api_select_source_record(request_id):
    denied = require_roles("ADMIN", "BURIAL_ADMIN")

    if denied:
        return denied

    try:
        cert_request = db.session.get(CertificateRequest, request_id)

        if not cert_request:
            return {"error": "Request not found"}, 404

        if not staff_can_access_request(cert_request):
            return {"error": "Forbidden"}, 403

        if cert_request.status in {"Released", "Rejected"}:
            return {
                "error": f"A {cert_request.status.lower()} request cannot change its source record."
            }, 400

        data = request.get_json(silent=True) or {}
        document_id = data.get("documentId")

        if not document_id:
            return {"error": "Document ID is required"}, 400

        document = db.session.get(Document, document_id)

        if not document or not document.active:
            return {"error": "Archive document not found"}, 404

        if document.sacrament_type not in allowed_types_for_current_role():
            return {"error": "Forbidden document"}, 403

        permitted_source_types = (
            {"ownership", "land_agreement"}
            if cert_request.sacrament_type == "ownership"
            else {cert_request.sacrament_type}
        )
        if document.sacrament_type not in permitted_source_types:
            return {
                "error": "Archive record category does not match the request."
            }, 400

        changed_source = cert_request.matched_document_id != document.id
        cert_request.matched_document_id = document.id

        # If staff changes the source after preparing a release document, the
        # old release file must not remain associated with the new source.
        if changed_source and cert_request.generated_file:
            old_release = normalize_path(cert_request.generated_file)
            if old_release.startswith("uploads/releases/"):
                old_physical = backend_storage_path(old_release)
                if os.path.isfile(old_physical):
                    try:
                        os.remove(old_physical)
                    except OSError:
                        pass
            cert_request.generated_file = None

        if cert_request.status == "Ready":
            cert_request.status = "Approved"

        cert_request.remarks = (
            "Archive source record verified. Staff may now approve and prepare the final release document."
            if cert_request.status == "Pending"
            else "Archive source record verified. Prepare the final release document for this request."
        )

        log = AuditLog(
            user=getattr(g, "user_email", None) or "Admin",
            action=(
                f"Selected archive source document #{document.id} "
                f"for request #{cert_request.id}"
            ),
            document_id=document.id,
        )

        db.session.add(log)
        db.session.commit()

        return {
            "message": "Archive source record selected successfully.",
            "request": serialize_request(cert_request),
        }, 200

    except Exception as e:
        db.session.rollback()
        return {"error": str(e)}, 500


@app.route("/api/requests/<int:request_id>/release-document", methods=["POST"])
def api_upload_release_document(request_id):
    denied = require_roles("ADMIN", "BURIAL_ADMIN")

    if denied:
        return denied

    try:
        cert_request = db.session.get(CertificateRequest, request_id)

        if not cert_request:
            return {"error": "Request not found"}, 404

        if not staff_can_access_request(cert_request):
            return {"error": "Forbidden"}, 403

        if cert_request.status not in {"Approved", "Ready"}:
            return {
                "error": "Approve the request before uploading the final release document."
            }, 400

        if not cert_request.matched_document_id:
            return {
                "error": "Select and verify the archive source record first."
            }, 400

        file = request.files.get("file")

        if not file or not file.filename:
            return {"error": "Choose the final document file first."}, 400

        filename = secure_filename(file.filename)
        extension = os.path.splitext(filename)[1].lower()
        allowed_extensions = {".pdf", ".docx", ".jpg", ".jpeg", ".png"}

        if extension not in allowed_extensions:
            return {
                "error": "Final document must be PDF, DOCX, JPG, JPEG, or PNG."
            }, 400

        relative_folder = f"uploads/releases/request_{cert_request.id}"
        physical_folder = backend_storage_path(relative_folder)
        os.makedirs(physical_folder, exist_ok=True)

        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        stem = secure_filename(os.path.splitext(filename)[0]) or "release_document"
        stored_filename = f"{stem}_{timestamp}{extension}"
        relative_path = f"{relative_folder}/{stored_filename}"
        physical_path = backend_storage_path(relative_path)

        old_release = normalize_path(cert_request.generated_file or "")
        if old_release.startswith("uploads/releases/"):
            old_physical = backend_storage_path(old_release)
            if os.path.isfile(old_physical):
                try:
                    os.remove(old_physical)
                except OSError:
                    pass

        file.save(physical_path)

        cert_request.generated_file = relative_path
        cert_request.status = "Ready"
        cert_request.remarks = (
            "Final document prepared. Payment confirmed; waiting for staff release."
            if cert_request.payment_status == "Paid"
            else "Final document prepared. Payment is required before release."
        )

        log = AuditLog(
            user=getattr(g, "user_email", None) or "Admin",
            action=f"Uploaded final release document for request #{cert_request.id}",
            document_id=cert_request.matched_document_id,
        )

        db.session.add(log)
        db.session.commit()

        return {
            "message": "Final release document uploaded successfully.",
            "request": serialize_request(cert_request),
        }, 200

    except Exception as e:
        db.session.rollback()
        return {"error": str(e)}, 500


@app.route("/api/requests/<int:request_id>/generate-document", methods=["POST"])
def api_generate_release_document(request_id):
    denied = require_roles("ADMIN", "BURIAL_ADMIN")
    if denied:
        return denied

    try:
        cert_request = db.session.get(CertificateRequest, request_id)
        if not cert_request:
            return {"error": "Request not found."}, 404
        if not staff_can_access_request(cert_request):
            return {"error": "Forbidden"}, 403
        if cert_request.status not in {"Approved", "Ready"}:
            return {"error": "Approve the request before generating the final document."}, 400
        if not cert_request.matched_document_id:
            return {"error": "Select and verify the archive source record first."}, 400

        source = db.session.get(Document, cert_request.matched_document_id)
        if not source or not source.active:
            return {"error": "Verified archive source record is no longer available."}, 404

        relative_folder = f"uploads/drafts/request_{cert_request.id}"
        physical_folder = backend_storage_path(relative_folder)
        os.makedirs(physical_folder, exist_ok=True)

        filename = f"IFI_request_{cert_request.id:04d}_{source.sacrament_type}_DRAFT.pdf"
        relative_path = f"{relative_folder}/{filename}"
        physical_path = backend_storage_path(relative_path)

        old_draft = normalize_path(cert_request.draft_file or "")
        if old_draft.startswith("uploads/drafts/") and old_draft != relative_path:
            old_physical = backend_storage_path(old_draft)
            if os.path.isfile(old_physical):
                try:
                    os.remove(old_physical)
                except OSError:
                    pass

        generate_official_draft(cert_request, source, physical_path)
        cert_request.draft_file = relative_path
        cert_request.remarks = (
            "Official-form draft prepared from the verified archive record. "
            "Review all details, complete required signatures/legal fields, then upload the final document."
        )
        db.session.add(AuditLog(
            user=getattr(g, "user_email", None) or "Admin",
            action=f"Generated official-form draft for request #{cert_request.id}",
            document_id=cert_request.matched_document_id,
        ))
        db.session.commit()

        return {
            "message": "Official-form draft generated successfully. Review it before uploading the final document.",
            "request": serialize_request(cert_request),
        }, 200
    except (TemplateNotConfiguredError, TemplateDataError) as error:
        db.session.rollback()
        return {"error": str(error)}, 400
    except Exception as error:
        db.session.rollback()
        return {"error": str(error)}, 500


@app.route("/api/requests/<int:request_id>/download", methods=["GET"])
def api_download_request_document(request_id):
    cert_request = db.session.get(CertificateRequest, request_id)
    if not cert_request:
        return {"error": "Request not found."}, 404

    role = getattr(g, "user_role", None)
    user_id = current_user_id()

    if role == "USER":
        if not user_id or cert_request.requester_user_id != user_id:
            return {"error": "Forbidden"}, 403
        if cert_request.status != "Released" or cert_request.payment_status != "Paid":
            return {"error": "This document is not available for download yet."}, 403
    elif role in {"ADMIN", "BURIAL_ADMIN"}:
        if not staff_can_access_request(cert_request):
            return {"error": "Forbidden"}, 403
    else:
        return {"error": "Forbidden"}, 403

    if not cert_request.generated_file:
        return {"error": "No release document is attached to this request."}, 404

    normalized = normalize_path(cert_request.generated_file)
    physical_path = backend_storage_path(normalized)
    if not os.path.isfile(physical_path):
        return {"error": "Release document file is missing."}, 404

    return send_from_directory(
        os.path.dirname(physical_path),
        os.path.basename(physical_path),
        as_attachment=True,
        download_name=os.path.basename(physical_path),
    )


@app.route("/download/<path:filepath>")

def download_file(filepath):

    if not can_access_filepath(filepath):

        return {"error": "Forbidden"}, 403

    return send_from_directory(

        BACKEND_DIR,

        normalize_path(filepath),

        as_attachment=True

    )



@app.route("/api/masses", methods=["GET"])

def api_get_masses():

    denied = require_roles("USER", "ADMIN")

    if denied:

        return denied

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

    denied = require_roles("ADMIN")

    if denied:

        return denied

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

            relative_folder = "uploads/masses"

            folder = backend_storage_path(relative_folder)

            os.makedirs(folder, exist_ok=True)



            filename = secure_filename(file.filename)

            if not filename:

                return {"error": "Invalid filename"}, 400

            filepath = f"{relative_folder}/{filename}"

            file.save(backend_storage_path(filepath))



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

    denied = require_roles("ADMIN")

    if denied:

        return denied

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

    denied = require_roles("ADMIN")

    if denied:

        return denied

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

    denied = require_roles("ADMIN")

    if denied:

        return denied

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

    denied = require_roles("USER", "ADMIN")

    if denied:

        return denied

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

    denied = require_roles("USER", "ADMIN")

    if denied:

        return denied

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

    denied = require_roles("ADMIN")

    if denied:

        return denied

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

    denied = require_roles("ADMIN")

    if denied:

        return denied

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

    denied = require_roles("USER")

    if denied:

        return denied

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



        month_start = datetime.utcnow().replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        this_month_uploads = MassRecord.query.filter(
            MassRecord.active == True,
            MassRecord.created_at >= month_start,
        ).count()



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

    denied = require_roles("ADMIN")

    if denied:

        return denied

    try:

        mass = MassRecord.query.get(mass_id)



        if not mass or not mass.active:

            return {"error": "Mass record not found"}, 404



        if not mass.filepath:

            return {"error": "This mass has no uploaded audio/video file"}, 400



        original_path = backend_storage_path(mass.filepath)



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



        whisper_model = get_whisper_model()

        segments, info = whisper_model.transcribe(

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

        mass.transcript_filepath = f"uploads/transcriptions/{pdf_filename}"

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





@app.route("/api/archive/deleted-documents")

def api_deleted_documents():

    denied = require_roles("ADMIN", "BURIAL_ADMIN")

    if denied:

        return denied

    try:

        allowed_types = allowed_types_for_current_role()



        documents = Document.query.filter(

            Document.active == False,

            Document.sacrament_type.in_(allowed_types)

        ).order_by(

            Document.id.desc()

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

                    "department": d.department,

                    "filename": d.filename,

                    "filepath": d.filepath,

                    "uploadedBy": d.uploaded_by,
                    "recordData": json.loads(d.record_data) if d.record_data else {},

                }

                for d in documents

            ]

        }



    except Exception as e:

        return {"error": str(e)}, 500





@app.route("/api/archive/documents/<int:document_id>/delete", methods=["PATCH"])

def api_soft_delete_document(document_id):

    denied = require_roles("ADMIN", "BURIAL_ADMIN")

    if denied:

        return denied

    try:

        document = Document.query.get(document_id)



        if not document:

            return {"error": "Document not found"}, 404



        if document.sacrament_type not in allowed_types_for_current_role():

            return {"error": "Forbidden"}, 403



        document.active = False

        db.session.commit()



        log = AuditLog(

            user="Admin",

            action=f"Moved archive document #{document.id} to recycle bin",

            document_id=document.id

        )



        db.session.add(log)

        db.session.commit()



        return {

            "message": "Document moved to recycle bin successfully",

            "document": {

                "id": document.id,

                "active": document.active

            }

        }



    except Exception as e:

        return {"error": str(e)}, 500





@app.route("/api/archive/documents/<int:document_id>/restore", methods=["PATCH"])

def api_restore_document(document_id):

    denied = require_roles("ADMIN", "BURIAL_ADMIN")

    if denied:

        return denied

    try:

        document = Document.query.get(document_id)



        if not document:

            return {"error": "Document not found"}, 404



        if document.sacrament_type not in allowed_types_for_current_role():

            return {"error": "Forbidden"}, 403



        document.active = True

        db.session.commit()



        log = AuditLog(

            user="Admin",

            action=f"Restored archive document #{document.id} from recycle bin",

            document_id=document.id

        )



        db.session.add(log)

        db.session.commit()



        return {

            "message": "Document restored successfully",

            "document": {

                "id": document.id,

                "active": document.active

            }

        }



    except Exception as e:

        return {"error": str(e)}, 500





# ---------------------------------------------------------------------------
# Burial / cemetery management
# ---------------------------------------------------------------------------

CEMETERY_SLOT_STATUSES = {"AVAILABLE", "RESERVED", "OCCUPIED"}
CEMETERY_LOT_TYPES = {"LAWN_LOT", "MAUSOLEUM", "MULTI_LEVEL_TOMB", "OSSUARY", "OTHER"}
CEMETERY_PAYMENT_PLANS = {"CASH", "DOWNPAYMENT", "INSTALLMENT"}
CEMETERY_PAYMENT_TYPES = {
    "RESERVATION_FEE",
    "DOWN_PAYMENT",
    "INSTALLMENT",
    "FULL_PAYMENT",
    "PERPETUAL_DUES",
    "INTERMENT_FEE",
    "OTHER",
}


def _cemetery_only():
    return require_roles("BURIAL_ADMIN")


def _safe_int(value, default=0, minimum=0):
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = default
    return max(number, minimum)


LOT_PAYMENT_TYPES = {"RESERVATION_FEE", "DOWN_PAYMENT", "INSTALLMENT", "FULL_PAYMENT"}


def _reservation_amount_paid(reservation):
    # Separate lot purchase payments from perpetual dues/interment charges.
    return sum((payment.amount or 0) for payment in reservation.payments
               if payment.payment_type in LOT_PAYMENT_TYPES)


def _reservation_balance(reservation):
    return max((reservation.total_price or 0) - _reservation_amount_paid(reservation), 0)


def serialize_cemetery_slot(slot):
    active_burials = [b for b in slot.burials if b.status == "ACTIVE"]
    latest_reservation = None
    if slot.reservations:
        latest_reservation = sorted(slot.reservations, key=lambda item: item.id, reverse=True)[0]

    return {
        "id": slot.id,
        "section": slot.section,
        "block": slot.block,
        "lotNumber": slot.lot_number,
        "slotCode": slot.slot_code,
        "lotType": slot.lot_type,
        "status": slot.status,
        "rightsHolderName": slot.rights_holder_name,
        "rightsHolderAddress": slot.rights_holder_address,
        "rightsHolderContact": slot.rights_holder_contact,
        "mapLabel": slot.map_label,
        "notes": slot.notes,
        "burialCount": len(active_burials),
        "burials": [
            {
                "id": burial.id,
                "deceasedName": burial.deceased_name,
                "burialDate": burial.burial_date,
            }
            for burial in active_burials
        ],
        "latestReservationId": latest_reservation.id if latest_reservation else None,
        "createdAt": slot.created_at.isoformat() if slot.created_at else None,
        "updatedAt": slot.updated_at.isoformat() if slot.updated_at else None,
    }


def serialize_cemetery_payment(payment):
    return {
        "id": payment.id,
        "reservationId": payment.reservation_id,
        "amount": payment.amount,
        "paymentType": payment.payment_type,
        "paymentMethod": payment.payment_method,
        "receiptNumber": payment.receipt_number,
        "paymentDate": payment.payment_date,
        "notes": payment.notes,
        "recordedBy": payment.recorded_by,
        "createdAt": payment.created_at.isoformat() if payment.created_at else None,
    }


def serialize_cemetery_reservation(reservation, include_payments=True):
    amount_paid = _reservation_amount_paid(reservation)
    balance = _reservation_balance(reservation)
    if balance == 0 and reservation.total_price > 0:
        payment_status = "FULLY_PAID"
    elif amount_paid > 0:
        payment_status = "PARTIALLY_PAID"
    else:
        payment_status = "UNPAID"

    return {
        "id": reservation.id,
        "raNumber": reservation.ra_number,
        "reservationDate": reservation.reservation_date,
        "buyerName": reservation.buyer_name,
        "buyerAddress": reservation.buyer_address,
        "buyerContact": reservation.buyer_contact,
        "civilStatus": reservation.civil_status,
        "spouseName": reservation.spouse_name,
        "slotId": reservation.slot_id,
        "slot": serialize_cemetery_slot(reservation.slot) if reservation.slot else None,
        "paymentPlan": reservation.payment_plan,
        "totalPrice": reservation.total_price,
        "reservationFee": reservation.reservation_fee,
        "requiredDownPayment": reservation.required_down_payment,
        "termMonths": reservation.term_months,
        "monthlyAmortization": reservation.monthly_amortization,
        "dueDate": reservation.due_date,
        "status": reservation.status,
        "paymentStatus": payment_status,
        "amountPaid": amount_paid,
        "balance": balance,
        "contractFile": reservation.contract_file,
        "notes": reservation.notes,
        "payments": [serialize_cemetery_payment(p) for p in sorted(reservation.payments, key=lambda x: x.id, reverse=True)] if include_payments else [],
        "createdAt": reservation.created_at.isoformat() if reservation.created_at else None,
        "updatedAt": reservation.updated_at.isoformat() if reservation.updated_at else None,
    }


def serialize_burial_record(record):
    details = {}
    if record.deceased_details:
        try:
            details = json.loads(record.deceased_details)
        except (TypeError, json.JSONDecodeError):
            details = {}
    return {
        "id": record.id,
        "slotId": record.slot_id,
        "slot": serialize_cemetery_slot(record.slot) if record.slot else None,
        "deceasedName": record.deceased_name,
        "burialDate": record.burial_date,
        "deathCertificateNumber": record.death_certificate_number,
        "deathCertificateFile": record.death_certificate_file,
        "burialPermitFile": record.burial_permit_file,
        "authorizationFile": record.authorization_file,
        "deceasedDetails": details,
        "notes": record.notes,
        "status": record.status,
        "createdAt": record.created_at.isoformat() if record.created_at else None,
        "updatedAt": record.updated_at.isoformat() if record.updated_at else None,
    }


def _save_cemetery_upload(file, subfolder, prefix):
    if not file or not getattr(file, "filename", None):
        return None
    filename = secure_filename(file.filename)
    if not filename:
        raise ValueError("Invalid uploaded filename")
    extension = os.path.splitext(filename)[1].lower()
    allowed = {".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"}
    if extension not in allowed:
        raise ValueError("Only PDF, image, DOC, and DOCX files are allowed.")
    relative_folder = f"uploads/cemetery/{subfolder}"
    physical_folder = backend_storage_path(relative_folder)
    os.makedirs(physical_folder, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    stored_name = f"{prefix}_{timestamp}{extension}"
    relative_path = f"{relative_folder}/{stored_name}"
    file.save(backend_storage_path(relative_path))
    return relative_path


@app.route("/api/cemetery/map", methods=["GET"])
def api_cemetery_map():
    denied = _cemetery_only()
    if denied:
        return denied
    filename = "site_master_plan_reference.png"
    physical = os.path.join(CEMETERY_UPLOAD_FOLDER, filename)
    if not os.path.isfile(physical):
        return {"error": "Cemetery reference map has not been uploaded yet."}, 404
    return send_from_directory(CEMETERY_UPLOAD_FOLDER, filename, as_attachment=False)


@app.route("/api/cemetery/dashboard", methods=["GET"])
def api_cemetery_dashboard():
    denied = _cemetery_only()
    if denied:
        return denied

    slots = CemeterySlot.query.filter_by(active=True).all()
    reservations = CemeteryReservation.query.order_by(CemeteryReservation.id.desc()).all()
    burials = BurialRecord.query.filter_by(status="ACTIVE").all()
    payments = CemeteryPayment.query.order_by(CemeteryPayment.id.desc()).limit(8).all()

    outstanding = sum(_reservation_balance(r) for r in reservations if r.status == "ACTIVE")
    partially_paid = sum(1 for r in reservations if 0 < _reservation_amount_paid(r) < (r.total_price or 0))
    unpaid = sum(1 for r in reservations if _reservation_amount_paid(r) == 0 and (r.total_price or 0) > 0)
    today_text = datetime.utcnow().date().isoformat()
    overdue = sum(
        1
        for r in reservations
        if r.status == "ACTIVE"
        and r.due_date
        and r.due_date < today_text
        and _reservation_balance(r) > 0
    )

    return {
        "counts": {
            "totalSlots": len(slots),
            "availableSlots": sum(1 for s in slots if s.status == "AVAILABLE"),
            "reservedSlots": sum(1 for s in slots if s.status == "RESERVED"),
            "occupiedSlots": sum(1 for s in slots if s.status == "OCCUPIED"),
            "activeReservations": sum(1 for r in reservations if r.status == "ACTIVE"),
            "burialRecords": len(burials),
            "partiallyPaid": partially_paid,
            "unpaid": unpaid,
            "overdue": overdue,
            "outstandingBalance": outstanding,
        },
        "recentPayments": [serialize_cemetery_payment(p) for p in payments],
        "recentReservations": [serialize_cemetery_reservation(r, include_payments=False) for r in reservations[:5]],
    }, 200


@app.route("/api/cemetery/slots", methods=["GET", "POST"])
def api_cemetery_slots():
    denied = _cemetery_only()
    if denied:
        return denied

    if request.method == "GET":
        q = (request.args.get("q") or "").strip()
        status = (request.args.get("status") or "").strip().upper()
        query = CemeterySlot.query.filter_by(active=True)
        if status in CEMETERY_SLOT_STATUSES:
            query = query.filter(CemeterySlot.status == status)
        if q:
            like = f"%{q}%"
            query = query.filter(
                (CemeterySlot.slot_code.ilike(like))
                | (CemeterySlot.lot_number.ilike(like))
                | (CemeterySlot.block.ilike(like))
                | (CemeterySlot.section.ilike(like))
                | (CemeterySlot.rights_holder_name.ilike(like))
            )
        slots = query.order_by(CemeterySlot.section, CemeterySlot.block, CemeterySlot.lot_number).all()
        return {"slots": [serialize_cemetery_slot(slot) for slot in slots]}, 200

    data = request.get_json(silent=True) or {}
    lot_number = (data.get("lotNumber") or "").strip()
    block = (data.get("block") or "").strip() or None
    section = (data.get("section") or "").strip() or None
    lot_type = (data.get("lotType") or "LAWN_LOT").strip().upper()
    slot_code = (data.get("slotCode") or "").strip()
    if not lot_number:
        return {"error": "Lot number is required."}, 400
    if lot_type not in CEMETERY_LOT_TYPES:
        return {"error": "Invalid lot type."}, 400
    if not slot_code:
        slot_code = "-".join(part for part in [section, block, lot_number] if part) or f"LOT-{lot_number}"
    existing = CemeterySlot.query.filter_by(slot_code=slot_code).first()
    if existing:
        return {"error": "That cemetery slot code already exists."}, 409

    slot = CemeterySlot(
        section=section,
        block=block,
        lot_number=lot_number,
        slot_code=slot_code,
        lot_type=lot_type,
        status="AVAILABLE",
        map_label=(data.get("mapLabel") or "").strip() or None,
        notes=(data.get("notes") or "").strip() or None,
    )
    db.session.add(slot)
    db.session.commit()
    return {"message": "Cemetery slot created.", "slot": serialize_cemetery_slot(slot)}, 201


@app.route("/api/cemetery/slots/<int:slot_id>", methods=["PATCH"])
def api_update_cemetery_slot(slot_id):
    denied = _cemetery_only()
    if denied:
        return denied
    slot = db.session.get(CemeterySlot, slot_id)
    if not slot or not slot.active:
        return {"error": "Cemetery slot not found."}, 404
    data = request.get_json(silent=True) or {}
    if "status" in data:
        status = str(data.get("status") or "").upper()
        if status not in CEMETERY_SLOT_STATUSES:
            return {"error": "Invalid slot status."}, 400
        slot.status = status
    for attr, key, limit in [
        ("rights_holder_name", "rightsHolderName", 200),
        ("rights_holder_address", "rightsHolderAddress", 500),
        ("rights_holder_contact", "rightsHolderContact", 100),
        ("map_label", "mapLabel", 120),
        ("notes", "notes", 1000),
    ]:
        if key in data:
            setattr(slot, attr, (str(data.get(key) or "").strip()[:limit] or None))
    db.session.commit()
    return {"message": "Cemetery slot updated.", "slot": serialize_cemetery_slot(slot)}, 200


@app.route("/api/cemetery/reservations", methods=["GET", "POST"])
def api_cemetery_reservations():
    denied = _cemetery_only()
    if denied:
        return denied

    if request.method == "GET":
        q = (request.args.get("q") or "").strip()
        query = CemeteryReservation.query
        if q:
            like = f"%{q}%"
            query = query.join(CemeterySlot).filter(
                (CemeteryReservation.buyer_name.ilike(like))
                | (CemeteryReservation.ra_number.ilike(like))
                | (CemeterySlot.slot_code.ilike(like))
                | (CemeterySlot.lot_number.ilike(like))
            )
        reservations = query.order_by(CemeteryReservation.id.desc()).all()
        return {"reservations": [serialize_cemetery_reservation(r) for r in reservations]}, 200

    data = request.get_json(silent=True) or {}
    buyer_name = (data.get("buyerName") or "").strip()
    slot_id = _safe_int(data.get("slotId"), 0)
    if not buyer_name:
        return {"error": "Buyer name is required."}, 400
    slot = db.session.get(CemeterySlot, slot_id)
    if not slot or not slot.active:
        return {"error": "Select a valid cemetery slot."}, 400
    if slot.status != "AVAILABLE":
        return {"error": "The selected cemetery slot is not available."}, 409

    plan = str(data.get("paymentPlan") or "CASH").upper()
    if plan not in CEMETERY_PAYMENT_PLANS:
        return {"error": "Invalid payment plan."}, 400

    total_price = _safe_int(data.get("totalPrice"))
    reservation_fee = _safe_int(data.get("reservationFee"))
    down_payment = _safe_int(data.get("requiredDownPayment"))
    term_months = _safe_int(data.get("termMonths"))
    if total_price <= 0:
        return {"error": "Lot price must be greater than zero."}, 400
    if reservation_fee > total_price or down_payment > total_price:
        return {"error": "Reservation fee/down payment cannot exceed lot price."}, 400
    if plan == "INSTALLMENT" and term_months <= 0:
        return {"error": "Installment plans require a positive term in months."}, 400
    if plan == "DOWNPAYMENT" and down_payment <= 0:
        return {"error": "Down payment plan requires a positive down payment."}, 400

    ra_number = (data.get("raNumber") or "").strip() or None
    if ra_number and CemeteryReservation.query.filter_by(ra_number=ra_number).first():
        return {"error": "That R.A. number already exists."}, 409

    reservation = CemeteryReservation(
        ra_number=ra_number,
        reservation_date=(data.get("reservationDate") or "").strip() or None,
        buyer_name=buyer_name,
        buyer_address=(data.get("buyerAddress") or "").strip() or None,
        buyer_contact=(data.get("buyerContact") or "").strip() or None,
        civil_status=(data.get("civilStatus") or "").strip() or None,
        spouse_name=(data.get("spouseName") or "").strip() or None,
        slot_id=slot.id,
        payment_plan=plan,
        total_price=total_price,
        reservation_fee=reservation_fee,
        required_down_payment=down_payment if plan != "CASH" else 0,
        term_months=term_months if plan == "INSTALLMENT" else None,
        monthly_amortization=_safe_int(data.get("monthlyAmortization"), 0) or None,
        due_date=(data.get("dueDate") or "").strip() or None,
        notes=(data.get("notes") or "").strip() or None,
        status="ACTIVE",
    )
    slot.status = "RESERVED"
    slot.rights_holder_name = buyer_name
    slot.rights_holder_address = reservation.buyer_address
    slot.rights_holder_contact = reservation.buyer_contact
    db.session.add(reservation)
    db.session.commit()
    return {"message": "Reservation created.", "reservation": serialize_cemetery_reservation(reservation)}, 201


@app.route("/api/cemetery/reservations/<int:reservation_id>/contract", methods=["POST"])
def api_upload_cemetery_contract(reservation_id):
    denied = _cemetery_only()
    if denied:
        return denied
    reservation = db.session.get(CemeteryReservation, reservation_id)
    if not reservation:
        return {"error": "Reservation not found."}, 404
    file = request.files.get("file")
    try:
        path = _save_cemetery_upload(file, f"reservations/{reservation_id}", "contract")
    except ValueError as error:
        return {"error": str(error)}, 400
    if not path:
        return {"error": "Choose a contract image or document."}, 400
    reservation.contract_file = path
    db.session.commit()
    return {"message": "Contract uploaded.", "reservation": serialize_cemetery_reservation(reservation)}, 200


@app.route("/api/cemetery/reservations/<int:reservation_id>/payments", methods=["POST"])
def api_add_cemetery_payment(reservation_id):
    denied = _cemetery_only()
    if denied:
        return denied
    reservation = db.session.get(CemeteryReservation, reservation_id)
    if not reservation:
        return {"error": "Reservation not found."}, 404
    data = request.get_json(silent=True) or {}
    amount = _safe_int(data.get("amount"))
    if amount <= 0:
        return {"error": "Payment amount must be greater than zero."}, 400
    payment_type = str(data.get("paymentType") or "INSTALLMENT").upper()
    if payment_type not in CEMETERY_PAYMENT_TYPES:
        return {"error": "Invalid payment type."}, 400
    current_balance = _reservation_balance(reservation)
    if payment_type in LOT_PAYMENT_TYPES and amount > current_balance:
        return {"error": f"Lot payment exceeds the remaining balance of PHP {current_balance:,}."}, 400

    payment = CemeteryPayment(
        reservation=reservation,
        amount=amount,
        payment_type=payment_type,
        payment_method=str(data.get("paymentMethod") or "CASH").upper()[:50],
        receipt_number=(data.get("receiptNumber") or "").strip() or None,
        payment_date=(data.get("paymentDate") or "").strip() or datetime.utcnow().date().isoformat(),
        notes=(data.get("notes") or "").strip() or None,
        recorded_by=getattr(g, "user_email", None) or "Burial Admin",
    )
    db.session.add(payment)
    db.session.flush()
    if _reservation_balance(reservation) == 0 and reservation.total_price > 0:
        reservation.status = "COMPLETED"
    db.session.commit()
    return {
        "message": "Payment recorded.",
        "payment": serialize_cemetery_payment(payment),
        "reservation": serialize_cemetery_reservation(reservation),
    }, 201


@app.route("/api/cemetery/payments", methods=["GET"])
def api_cemetery_payments():
    denied = _cemetery_only()
    if denied:
        return denied
    reservation_id = _safe_int(request.args.get("reservationId"), 0)
    query = CemeteryPayment.query
    if reservation_id:
        query = query.filter_by(reservation_id=reservation_id)
    payments = query.order_by(CemeteryPayment.id.desc()).all()
    return {"payments": [serialize_cemetery_payment(p) for p in payments]}, 200


@app.route("/api/cemetery/burials", methods=["GET", "POST"])
def api_cemetery_burials():
    denied = _cemetery_only()
    if denied:
        return denied

    if request.method == "GET":
        q = (request.args.get("q") or "").strip()
        query = BurialRecord.query.filter(BurialRecord.status == "ACTIVE")
        if q:
            like = f"%{q}%"
            query = query.join(CemeterySlot).filter(
                (BurialRecord.deceased_name.ilike(like))
                | (BurialRecord.death_certificate_number.ilike(like))
                | (CemeterySlot.slot_code.ilike(like))
                | (CemeterySlot.lot_number.ilike(like))
                | (CemeterySlot.rights_holder_name.ilike(like))
            )
        records = query.order_by(BurialRecord.id.desc()).all()
        return {"burials": [serialize_burial_record(record) for record in records]}, 200

    form = request.form
    deceased_name = (form.get("deceased_name") or "").strip()
    slot_id = _safe_int(form.get("slot_id"), 0)
    if not deceased_name:
        return {"error": "Deceased name is required."}, 400
    slot = db.session.get(CemeterySlot, slot_id)
    if not slot or not slot.active:
        return {"error": "Select a valid cemetery slot."}, 400

    try:
        death_certificate_file = _save_cemetery_upload(
            request.files.get("death_certificate"),
            f"burials/{slot.id}",
            "death_certificate",
        )
        burial_permit_file = _save_cemetery_upload(
            request.files.get("burial_permit"),
            f"burials/{slot.id}",
            "burial_permit",
        )
        authorization_file = _save_cemetery_upload(
            request.files.get("authorization"),
            f"burials/{slot.id}",
            "authorization",
        )
    except ValueError as error:
        return {"error": str(error)}, 400

    # Reusing an already occupied niche/lot is allowed only when staff uploads
    # an authorization document, matching the client interview workflow.
    existing_active_burials = [b for b in slot.burials if b.status == "ACTIVE"]
    if existing_active_burials and not authorization_file:
        return {
            "error": "This slot already has a burial record. Upload an authorization document before adding another interment."
        }, 400

    details = {}
    raw_details = form.get("deceased_details")
    if raw_details:
        try:
            details = json.loads(raw_details)
        except json.JSONDecodeError:
            return {"error": "Invalid deceased details data."}, 400

    record = BurialRecord(
        slot_id=slot.id,
        deceased_name=deceased_name,
        burial_date=(form.get("burial_date") or "").strip() or None,
        death_certificate_number=(form.get("death_certificate_number") or "").strip() or None,
        death_certificate_file=death_certificate_file,
        burial_permit_file=burial_permit_file,
        authorization_file=authorization_file,
        deceased_details=json.dumps(details, ensure_ascii=False) if details else None,
        notes=(form.get("notes") or "").strip() or None,
        status="ACTIVE",
    )
    slot.status = "OCCUPIED"
    db.session.add(record)
    db.session.commit()
    return {"message": "Burial record created.", "burial": serialize_burial_record(record)}, 201


@app.route("/api/cemetery/files/<path:filepath>", methods=["GET"])
def api_cemetery_file(filepath):
    denied = _cemetery_only()
    if denied:
        return denied
    normalized = normalize_path(filepath)
    if not normalized.startswith("uploads/cemetery/"):
        return {"error": "Forbidden"}, 403
    physical = backend_storage_path(normalized)
    if not os.path.isfile(physical):
        return {"error": "File not found."}, 404
    return send_from_directory(os.path.dirname(physical), os.path.basename(physical), as_attachment=False)




# PAYMONGO_CERTIFICATE_V1 — server-authoritative checkout and reconciliation
import base64
import urllib.request
import urllib.error


def _paymongo_api(method, path, payload=None):
    key = os.getenv("PAYMONGO_SECRET_KEY", "")
    if not key.startswith("sk_test_"):
        raise ValueError("A PayMongo TEST secret key (sk_test_) is required.")
    headers = {"Authorization": "Basic " + base64.b64encode((key + ":").encode()).decode(),
               "Content-Type": "application/json", "Accept": "application/json"}
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request("https://api.paymongo.com" + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=18) as res:
            return json.loads(res.read().decode())
    except urllib.error.HTTPError as ex:
        app.logger.warning("PayMongo API error %s: %s", ex.code, ex.read().decode()[:500])
        raise RuntimeError("PayMongo rejected this operation. Check test keys and enabled payment channels.") from ex


@app.route("/api/requests/<int:request_id>/paymongo-checkout", methods=["POST"])
def certificate_checkout(request_id):
    denied = require_roles("USER")
    if denied: return denied
    cert = db.session.get(CertificateRequest, request_id)
    if not cert: return {"error": "Request not found"}, 404
    if cert.requester_user_id != current_user_id(): return {"error": "Forbidden"}, 403
    if cert.status not in {"Approved", "Ready"}: return {"error": "Approval required"}, 400
    if cert.payment_status == "Paid": return {"error": "Already paid"}, 409
    if (cert.payment_reference or "").startswith("cs_"):
        # Do not overwrite possibly paid/pending sessions. Query provider first.
        try:
            prior = _paymongo_api("GET", "/v1/checkout_sessions/" + cert.payment_reference)["data"]["attributes"]
            prior_status = str(prior.get("status") or "").lower()
            prior_payments = prior.get("payments") or []
            has_paid = any(isinstance(p, dict) and p.get("attributes", p).get("status") == "paid" for p in prior_payments)
            if has_paid:
                return {"error": "Prior checkout may be paid. Await payment confirmation; do not retry."}, 409
            if prior_status not in {"expired", "cancelled", "canceled"}:
                return {"error": "Previous checkout remains active or unverified. Finish it or wait for expiry."}, 409
        except Exception:
            app.logger.exception("Cannot safely reconcile previous PayMongo checkout")
            return {"error": "Unable to verify prior checkout. Retry later or contact staff."}, 502
    price = CERTIFICATE_BASE_FEES.get(cert.sacrament_type, 0)
    if price <= 0: return {"error": "Fee for this certificate has not been confirmed by the parish."}, 409
    total = price + (DEMO_URGENT_FEE if cert.is_urgent else 0)
    if cert.total_fee != total or cert.base_fee != price or cert.urgent_fee != total-price:
        # Do not silently overwrite previously quoted amount; staff must reconcile it first.
        return {"error": "Stored request fee does not match the configured parish fee. Please reconcile before checkout."}, 409
    public_url = os.getenv("APP_BASE_URL", "").rstrip("/")
    if not public_url.startswith("https://"):
        return {"error": "APP_BASE_URL must be a public HTTPS address for PayMongo checkout."}, 503
    methods = [s.strip() for s in os.getenv("PAYMONGO_METHODS", "card").split(",") if s.strip()]
    if not methods: return {"error": "No PayMongo methods configured"}, 500
    body = {"data": {"attributes": {
        "billing": {"email": cert.requester_email, "name": cert.requester_name},
        "cancel_url": public_url + "/dashboard",
        "success_url": public_url + "/dashboard",
        "description": "Smart Parish certificate request #" + str(cert.id),
        "reference_number": "PARISH-CERT-" + str(cert.id),
        "line_items": [{"name": "Certificate request #"+str(cert.id), "quantity": 1, "currency": "PHP", "amount": total*100}],
        "payment_method_types": methods,
        "send_email_receipt": False,
        "show_description": True,
        "show_line_items": True
    }}}
    try:
        result = _paymongo_api("POST", "/v1/checkout_sessions", body)
        session = result["data"]
        sid = session["id"]
        url = session["attributes"]["checkout_url"]
        if not isinstance(url, str) or not url.startswith("https://checkout.paymongo.com/"):
            raise ValueError("Unexpected checkout URL")
        cert.payment_reference = sid
        cert.payment_method = "PAYMONGO_TEST_PENDING"
        db.session.commit()
        return {"checkoutUrl": url}
    except Exception:
        db.session.rollback()
        app.logger.exception("PayMongo checkout creation failed")
        return {"error": "Unable to start PayMongo test checkout; verify configuration."}, 502


@app.route("/api/paymongo/confirm-internal", methods=["POST"])
def paymongo_confirm_internal():
    # The public Next.js webhook verifies PayMongo's HMAC signature first.
    # The private Flask API additionally requires its internal key and reserved role.
    if request.headers.get("X-User-Role") != "PAYMONGO_WEBHOOK":
        return {"error": "Forbidden"}, 403
    data = request.get_json(silent=True) or {}
    session_id = str(data.get("checkoutSessionId") or "")
    if not session_id.startswith("cs_"): return {"error": "Invalid checkout reference"}, 400
    cert = CertificateRequest.query.filter_by(payment_reference=session_id).first()
    if not cert: return {"error": "Unknown checkout session"}, 404
    if cert.payment_status == "Paid": return {"ok": True, "alreadyProcessed": True}, 200
    if cert.status not in {"Approved", "Ready"}: return {"error": "Request not approved"}, 409
    try:
        # Independently query PayMongo; do not trust webhook client fields for amount.
        actual = _paymongo_api("GET", "/v1/checkout_sessions/" + session_id)["data"]["attributes"]
        if actual.get("livemode") is True: return {"error": "Live mode not allowed"}, 409
        if actual.get("reference_number") != "PARISH-CERT-" + str(cert.id):
            return {"error": "Reference mismatch"}, 409
        price = CERTIFICATE_BASE_FEES.get(cert.sacrament_type, 0)
        total = price + (DEMO_URGENT_FEE if cert.is_urgent else 0)
        if price <= 0 or cert.total_fee != total: return {"error": "Amount mismatch"}, 409
        payments = actual.get("payments") or []
        success = any(p.get("attributes", p).get("status") == "paid" and
                      p.get("attributes", p).get("amount") == total * 100 for p in payments if isinstance(p, dict))
        if not success: return {"error": "Verified paid transaction not found"}, 409
        cert.payment_status = "Paid"
        cert.payment_method = "PAYMONGO_TEST"
        cert.paid_at = datetime.utcnow()
        db.session.add(AuditLog(user="PAYMONGO_WEBHOOK", action=f"Verified PayMongo test payment for certificate #{cert.id}", document_id=cert.matched_document_id))
        db.session.commit()
        return {"ok": True}, 200
    except Exception:
        db.session.rollback()
        app.logger.exception("PayMongo webhook verification failed")
        return {"error": "Unable to verify checkout against PayMongo"}, 502

if __name__ == "__main__":

    app.run(host="127.0.0.1", port=5000, debug=os.environ.get("FLASK_DEBUG") == "1")