"""Private object storage for uploads. PostgreSQL maps legacy paths to immutable objects."""
import hashlib
import os
import re
from pathlib import Path
import tempfile
from functools import lru_cache
from sqlalchemy import text

from models import db
from urllib.parse import quote, urlsplit
import requests


def storage_provider():
    mode = os.getenv("PARISH_STORAGE_PROVIDER", "s3").strip().lower()
    if mode not in {"s3", "supabase_rest"}:
        raise RuntimeError("Unsupported private storage provider.")
    return mode


def _rest_credentials():
    """Only for trusted Flask server; this bypass-RLS key must never reach browsers."""
    base = os.environ["PARISH_SUPABASE_URL"].strip().rstrip("/")
    parsed = urlsplit(base)
    if (parsed.scheme != "https" or not parsed.hostname
            or not parsed.hostname.endswith(".supabase.co")
            or parsed.username or parsed.password or parsed.port or parsed.path not in ("", "/")
            or parsed.query or parsed.fragment):
        raise RuntimeError("Invalid HTTPS Supabase REST project URL.")
    key = os.environ["PARISH_SUPABASE_SERVICE_ROLE_KEY"].strip()
    if len(key) < 32:
        raise RuntimeError("Server-side Supabase service-role secret is missing.")
    return base, {"apikey": key, "Authorization": "Bearer " + key}


def _rest_object_url(bucket, name, authenticated=False):
    base, headers = _rest_credentials()
    prefix = "object/authenticated" if authenticated else "object"
    return (f"{base}/storage/v1/{prefix}/"
            f"{quote(bucket, safe='')}/{quote(name, safe='/')}"), headers


def _rest_download(bucket, name, destination):
    url, headers = _rest_object_url(bucket, name, authenticated=True)
    with requests.get(url, headers=headers, timeout=(8, 45), stream=True,
                      allow_redirects=False) as response:
        if response.status_code != 200:
            raise RuntimeError("Private Storage download failed (HTTP %s)." % response.status_code)
        with open(destination, "wb") as stream:
            for chunk in response.iter_content(chunk_size=128 * 1024):
                if chunk:
                    stream.write(chunk)


def _rest_upload(bucket, name, physical, digest):
    url, headers = _rest_object_url(bucket, name)
    headers = {**headers, "Content-Type": "application/octet-stream", "x-upsert": "false"}
    with open(physical, "rb") as source:
        response = requests.post(url, headers=headers, data=source,
                                 timeout=(8, 90), allow_redirects=False)
    # Supabase returns HTTP 400 "Asset Already Exists" in some Storage API versions.
    # Never trust that response alone: download and checksum-verify the object.
    if response.status_code not in (200, 201, 400, 409):
        raise RuntimeError("Private Storage upload failed (HTTP %s)." % response.status_code)
    with tempfile.TemporaryDirectory(prefix="parish-rest-verify-") as temp:
        downloaded = Path(temp) / "verify"
        _rest_download(bucket, name, downloaded)
        if file_digest(downloaded) != digest or downloaded.stat().st_size != os.path.getsize(physical):
            raise RuntimeError("Private Storage upload hash verification failed.")


def _rest_signed_url(bucket, name, expiry_seconds):
    base, headers = _rest_credentials()
    endpoint = f"{base}/storage/v1/object/sign/{quote(bucket, safe='')}/{quote(name, safe='/')}"
    response = requests.post(endpoint, headers=headers,
                             json={"expiresIn": expiry_seconds}, timeout=(8, 20),
                             allow_redirects=False)
    if response.status_code != 200:
        raise RuntimeError("Private Storage URL signing failed (HTTP %s)." % response.status_code)
    data = response.json()
    raw = data.get("signedURL") or data.get("signedUrl")
    if not isinstance(raw, str) or not raw:
        raise RuntimeError("Private Storage signing response missing URL.")
    if raw.startswith("/storage/v1/"):
        full = base + raw
    elif raw.startswith("/object/"):
        full = base + "/storage/v1" + raw
    elif raw.startswith("https://"):
        full = raw
    else:
        raise RuntimeError("Unexpected signed URL format.")
    if urlsplit(full).hostname != urlsplit(base).hostname:
        raise RuntimeError("Unexpected private Storage URL host.")
    return full


def check_connection():
    """Probe object-storage access, not only database bucket metadata."""
    bucket = private_bucket()
    if storage_provider() == "supabase_rest":
        base, headers = _rest_credentials()
        response = requests.get(f"{base}/storage/v1/bucket/{quote(bucket, safe='')}",
                                headers=headers, timeout=(8, 20), allow_redirects=False)
        if response.status_code != 200 or response.json().get("public") is not False:
            raise RuntimeError("Supabase private bucket REST preflight failed.")
    else:
        client().list_objects_v2(Bucket=bucket, MaxKeys=1)
    return bucket



def enabled():
    return os.getenv('PARISH_PRIVATE_UPLOADS') == 'enabled'


@lru_cache(maxsize=1)
def client():
    import boto3
    from botocore.config import Config
    endpoint = os.environ['PARISH_S3_ENDPOINT']
    if not endpoint.startswith('https://'):
        raise RuntimeError('Private storage needs an HTTPS endpoint.')
    return boto3.client('s3', endpoint_url=endpoint, region_name=os.environ['PARISH_S3_REGION'],
                        aws_access_key_id=os.environ['PARISH_S3_ACCESS_KEY'],
                        aws_secret_access_key=os.environ['PARISH_S3_SECRET_KEY'],
                        config=Config(connect_timeout=4, read_timeout=30, retries={'max_attempts': 1}))


def private_bucket():
    bucket = os.environ['PARISH_S3_BUCKET']
    private = db.session.execute(text('SELECT NOT public FROM storage.buckets WHERE id=:bucket'),
                                 {'bucket': bucket}).scalar_one_or_none()
    if private is not True:
        raise RuntimeError('Private bucket check failed.')
    return bucket


def file_digest(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def preserve(relative, physical):
    if not enabled():
        return
    bucket = private_bucket()
    category = relative.split('/')[1]
    quota = db.session.execute(text("SELECT byte_limit,max_file_bytes FROM parish_private.storage_quota WHERE category=:c FOR UPDATE"),
                               {'c':category}).first()
    if not quota:
        raise ValueError("Missing storage quota.")
    size = os.path.getsize(physical)
    usage = db.session.scalar(text("""SELECT coalesce(sum(size_bytes),0) FROM parish_private.upload_object
        WHERE split_part(logical_path,'/',2)=:c AND logical_path<>:p"""),{'c':category,'p':relative})
    if size>quota.max_file_bytes or size+usage>quota.byte_limit:
        raise ValueError("Private upload quota exceeded.")
    digest = file_digest(physical)
    if storage_provider() == "supabase_rest":
        _rest_upload(bucket, "parish/" + digest, physical, digest)
    else:
        client().upload_file(str(physical), bucket, 'parish/' + digest)
    db.session.execute(text('''INSERT INTO parish_private.upload_object(logical_path,sha256,size_bytes)
        VALUES (:path,:digest,:size) ON CONFLICT(logical_path) DO UPDATE SET
        sha256=excluded.sha256,size_bytes=excluded.size_bytes,updated_at=now()'''),
        {'path':relative, 'digest':digest, 'size':os.path.getsize(physical)})


def signed_download(relative, expiry_seconds=60):
    """Presign a previously indexed private object; call ONLY after role/owner authorization."""
    if not enabled() or not isinstance(relative, str) or not relative.startswith('uploads/'):
        return None
    row = db.session.execute(
        text("SELECT sha256 FROM parish_private.upload_object WHERE logical_path=:p"),
        {'p': relative},
    ).first()
    if not row or not re.fullmatch(r'[0-9a-f]{64}', row.sha256):
        return None
    expiry = min(max(int(expiry_seconds), 1), 60)
    if storage_provider() == "supabase_rest":
        return _rest_signed_url(private_bucket(), "parish/" + row.sha256, expiry)
    return client().generate_presigned_url(
        'get_object',
        Params={'Bucket': private_bucket(), 'Key': 'parish/' + row.sha256},
        ExpiresIn=expiry,
        HttpMethod='GET',
    )


def readable(relative, physical):
    if not enabled():
        return physical
    info = db.session.execute(text('SELECT sha256,size_bytes FROM parish_private.upload_object WHERE logical_path=:p'),
                              {'p':relative}).first()
    if not info:
        return physical
    # Cache by content hash so a rolled-back upload cannot shadow a committed record.
    directory = Path(os.environ.get('SMART_PARISH_UPLOAD_ROOT') or Path(physical).parent) / '.object-cache'
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    cached = directory / info.sha256
    if cached.is_file() and cached.stat().st_size == info.size_bytes:
        return str(cached)
    with tempfile.NamedTemporaryFile(dir=directory,delete=False) as stream:
        tmp = Path(stream.name)
    try:
        if storage_provider() == "supabase_rest":
            _rest_download(private_bucket(), "parish/" + info.sha256, tmp)
        else:
            client().download_file(private_bucket(), 'parish/' + info.sha256, str(tmp))
        if tmp.stat().st_size != info.size_bytes or file_digest(tmp) != info.sha256:
            raise RuntimeError('Stored file failed verification.')
        os.replace(tmp,cached)
    finally:
        tmp.unlink(missing_ok=True)
    return str(cached)
