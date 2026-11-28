import hmac
import os
import secrets
from sqlalchemy import text
from models import db


def digest(uid, email, code):
    key = os.environ["FLASK_INTERNAL_KEY"].encode()
    return hmac.new(key, f"certificate:{uid}:{email}:{code}".encode(), "sha256").hexdigest()


def issue(uid, email):
    code = f"{secrets.randbelow(1000000):06d}"
    result = db.session.execute(text("""INSERT INTO certificate_otp(user_id,email,digest)
        VALUES(:uid,:email,:digest) ON CONFLICT(user_id) DO UPDATE SET
        email=excluded.email,digest=excluded.digest,issued_at=now(),attempts=0
        WHERE certificate_otp.issued_at < now()-interval '1 minute' RETURNING user_id"""),
        {"uid":uid,"email":email,"digest":digest(uid,email,code)}).first()
    db.session.commit()
    return code if result else None


def consume(uid, email, code):
    row = db.session.execute(text("""SELECT digest FROM certificate_otp WHERE user_id=:uid
        AND email=:email AND attempts < 5 AND issued_at > now()-interval '10 minutes' FOR UPDATE"""),
        {"uid":uid,"email":email}).first()
    if not row:
        return False
    if not hmac.compare_digest(row.digest, digest(uid,email,code)):
        db.session.execute(text("UPDATE certificate_otp SET attempts=attempts+1 WHERE user_id=:uid"), {"uid":uid})
        db.session.commit()
        return False
    db.session.execute(text("DELETE FROM certificate_otp WHERE user_id=:uid"), {"uid":uid})
    return True
