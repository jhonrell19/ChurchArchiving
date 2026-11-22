"""Opt-in REAL HTTP certificate journey. Runs ONLY on a disposable PostgreSQL clone.

Required env:
 PARISH_E2E_DISPOSABLE=YES
 PARISH_E2E_DATABASE_NAME=parish_e2e_<unique>
 PARISH_E2E_DSN=<TLS verified psycopg DSN of clone>
 PARISH_E2E_BASE_URL=http://127.0.0.1:3000
 PARISH_E2E_ADMIN_ID=<synthetic, email-verified ADMIN in clone>
 PARISH_E2E_CONFIRM_APP_USES_CLONE=YES

The test substitutes one email token in its disposable clone because it cannot
read Resend/Gmail inboxes; therefore actual email delivery must be tested
manually. It does NOT bypass the verification API or ownership checks.
It uses opt-in synthetic CASH receipts; the cash-ledger migration/flag must
be active on the clone, not on the actual parish deployment.
"""
import hashlib
import io
import os
from pathlib import Path
import secrets
import uuid
from urllib.parse import urlsplit

import pytest

requests = pytest.importorskip("requests")
psycopg = pytest.importorskip("psycopg")
PIL = pytest.importorskip("PIL.Image")


@pytest.fixture(scope="module")
def env():
    if os.getenv("PARISH_E2E_DISPOSABLE") != "YES":
        pytest.skip("Real E2E writes disabled. Requires explicit disposable clone approval.")
    expected = os.getenv("PARISH_E2E_DATABASE_NAME", "")
    assert expected.startswith("parish_e2e_") and len(expected) > 13
    assert os.getenv("PARISH_E2E_CONFIRM_APP_USES_CLONE") == "YES"
    dsn = os.environ["PARISH_E2E_DSN"]
    with psycopg.connect(dsn) as connection:
        dbname = connection.execute("select current_database()").fetchone()[0]
        assert dbname == expected, "Refusing to write to a database outside the named clone"
    base = os.getenv("PARISH_E2E_BASE_URL", "").rstrip("/")
    host = urlsplit(base)
    assert host.scheme == "http" and host.hostname in {"127.0.0.1", "localhost"}, (
        "Run this test only through local Next.js attached to the disposable clone")
    return base, dsn, int(os.environ["PARISH_E2E_ADMIN_ID"])


def fictional_png():
    from PIL import Image, ImageDraw
    image = Image.new("RGB", (450, 180), "white")
    ImageDraw.Draw(image).text((18, 55), "FICTIONAL TEST ID - NOT A REAL RECORD", fill="black")
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()


def fictional_pdf():
    from PIL import Image
    buffer = io.BytesIO()
    Image.new("RGB", (400, 200), "white").save(buffer, "PDF")
    return buffer.getvalue()


def checked(response, code):
    assert response.status_code == code, (
        f"{response.request.method} {response.request.path_url}: "
        f"expected {code}, got {response.status_code}, "
        f"response {(response.text or '')[:250]}")
    return response.json() if "json" in response.headers.get("content-type", "") else response.content


def session_for_admin(base, dsn, admin_id):
    # Synthetic admin created in the isolated clone. This fixture intentionally
    # bypasses MFA *setup*; staff MFA must have its own acceptance test.
    token = secrets.token_urlsafe(48)
    with psycopg.connect(dsn) as db:
        user = db.execute('SELECT role FROM parish_auth."User" WHERE id=%s', (admin_id,)).fetchone()
        assert user and user[0] == "ADMIN", "Synthetic test admin is missing"
        db.execute('INSERT INTO parish_auth."Session"("tokenHash","userId","expiresAt") '
                   "VALUES(%s,%s,now()+interval '2 hours')",
                   (hashlib.sha256(token.encode()).hexdigest(), admin_id))
    client = requests.Session()
    client.cookies.set("parish_session", token, path="/")
    return client


def register_verify(base, dsn, display):
    email = "phase8-" + uuid.uuid4().hex + "@example.test"
    client = requests.Session()
    config = checked(client.get(base + "/api/portal-config", timeout=30), 200)
    fields = dict(firstName="Fictional", surname=display, email=email,
                  password="Sample#Only2026Strong!", confirmPassword="Sample#Only2026Strong!",
                  privacyConsent=True)
    if config.get("policy"):
        fields["policyVersion"] = config["policy"]["id"]
    checked(client.post(base + "/api/auth/register", json=fields, timeout=30), 201)
    with psycopg.connect(dsn) as db:
        row = db.execute('SELECT id FROM parish_auth."User" WHERE email=%s', (email,)).fetchone()
        assert row, "Registration did not persist"
        user_id = row[0]
        # Do not expose a real email verification token. Replace it with a
        # random fixture token inside this isolated database ONLY.
        token = secrets.token_urlsafe(32)
        db.execute('DELETE FROM parish_auth."EmailVerificationToken" WHERE "userId"=%s', (user_id,))
        db.execute('INSERT INTO parish_auth."EmailVerificationToken"("tokenHash","userId","expiresAt") '
                   "VALUES(%s,%s,now()+interval '1 hour')",
                   (hashlib.sha256(token.encode()).hexdigest(), user_id))
    checked(client.post(base + "/api/auth/verify-email", json={"token": token}, timeout=30), 200)
    return client, user_id, email, "Fictional " + display


def archive_fictional_scan(admin, base, person):
    payload = {
        "person_name": person, "sacrament_type": "baptismal",
        "date_of_record": "2015-05-17", "parish": "Fictional Test Parish",
        "priest": "Test Minister", "document_type": "Scanned Certificate",
        "record_data": __import__("json").dumps({
            "child_name": person, "date_of_baptism": "2015-05-17",
            "father_name": "Test Parent", "mother_name": "Sample Parent",
        }),
        "runOcr": "false", "review_confirmed": "true",
    }
    result = checked(admin.post(base + "/api/backend/api/archive/upload",
        data=payload, files={"file": ("fictional.png", fictional_png(), "image/png")},
        headers={"Origin": base}, timeout=90), 201)
    return result["document"]


def approve_member(client, admin, base, user_id, certificate):
    # Credentials are checked first; this request creates a short-lived
    # evidence-only cookie for a PENDING verified parishioner.
    result = client.post(base + "/api/auth/login", json={
        "email": client.test_email, "password": "Sample#Only2026Strong!"},
        headers={"Origin": base}, timeout=30)
    assert result.status_code == 403
    assert result.json().get("evidenceRequired"), "Enable PARISH_MEMBERSHIP_EVIDENCE in clone"
    evidence = client.post(base + "/api/verification",
        data=fictional_png(), headers={"Content-Type": "image/png",
          "Origin": base, "x-parish-record": certificate}, timeout=30)
    checked(evidence, 201)
    checked(admin.post(base + "/api/admin/membership", json={
        "userId": user_id, "decision": "approved", "reason": "Fictional record reviewed for E2E",
        "certificateNumber": certificate, "checked": True,
    }, headers={"Origin": base}, timeout=30), 200)
    checked(client.post(base + "/api/auth/login", json={
        "email": client.test_email, "password": "Sample#Only2026Strong!"},
        headers={"Origin": base}, timeout=30), 200)


def test_registration_to_release_and_private_download(env):
    base, dsn, admin_id = env
    assert checked(requests.get(base + "/api/ready", timeout=60), 200) == b"ready"
    admin = session_for_admin(base, dsn, admin_id)
    first, first_id, first_email, name = register_verify(base, dsn, "Testerone")
    first.test_email = first_email
    first_archive = archive_fictional_scan(admin, base, name)
    approve_member(first, admin, base, first_id, first_archive["certificateNumber"])
    second, second_id, second_email, second_name = register_verify(base, dsn, "Testertwo")
    second.test_email = second_email
    second_archive = archive_fictional_scan(admin, base, second_name)
    approve_member(second, admin, base, second_id, second_archive["certificateNumber"])

    config = checked(first.get(base + "/api/portal-config", timeout=30), 200)
    purpose = next(iter(config.get("purposes", {}).get("baptismal", [])), "Personal records")
    result = checked(first.post(base + "/api/backend/api/requests", json={
        "sacramentType": "baptismal", "personName": name, "purpose": purpose,
        "isUrgent": False, "recordDateHint": "2015-05-17"
    }, headers={"Origin": base}, timeout=60), 201)
    request_id = result["request"]["id"]
    checked(admin.patch(base + f"/api/backend/api/requests/{request_id}/select-record",
        json={"documentId": first_archive["id"]}, headers={"Origin": base}, timeout=60), 200)
    checked(admin.patch(base + f"/api/backend/api/requests/{request_id}/status",
        json={"status": "Approved"}, headers={"Origin": base}, timeout=60), 200)
    checked(admin.post(base + f"/api/backend/api/requests/{request_id}/generate-document",
        headers={"Origin": base}, timeout=60), 200)
    checked(admin.post(base + f"/api/backend/api/requests/{request_id}/release-document",
        files={"file": ("fictional-signed.pdf", fictional_pdf(), "application/pdf")},
        headers={"Origin": base}, timeout=60), 200)
    # Cash only on disposable clone, with opt-in immutable ledger enabled.
    cash_ref = "E2E-" + uuid.uuid4().hex[:16].upper()
    checked(admin.post(base + f"/api/backend/api/requests/{request_id}/cash-receipt",
        json={"action": "record", "receiptNumber": cash_ref, "reason": "Synthetic E2E cash settlement"},
        headers={"Origin": base}, timeout=60), 200)
    checked(admin.patch(base + f"/api/backend/api/requests/{request_id}/status",
        json={"status": "Released"}, headers={"Origin": base}, timeout=60), 200)
    certificate_bytes = checked(first.get(base + f"/api/backend/api/requests/{request_id}/download", timeout=60), 200)
    assert certificate_bytes.startswith(b"%PDF-")
    foreign = second.get(base + f"/api/backend/api/requests/{request_id}/download", timeout=30)
    assert foreign.status_code in (403,404)
    source = first_archive.get("originalScanUrl")
    assert source
    foreign_scan = second.get(base + source, timeout=30)
    assert foreign_scan.status_code in (403,404)
    print("E2E PASS: isolated clone register, token verification route, reviewed archive, membership, request, cash ledger, release, owner-only download")
