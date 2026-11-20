"""Private object storage for uploads. PostgreSQL maps legacy paths to immutable objects."""
import hashlib
import os
from pathlib import Path
import tempfile
from functools import lru_cache
from sqlalchemy import text

from models import db


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
    client().upload_file(str(physical), bucket, 'parish/' + digest)
    db.session.execute(text('''INSERT INTO parish_private.upload_object(logical_path,sha256,size_bytes)
        VALUES (:path,:digest,:size) ON CONFLICT(logical_path) DO UPDATE SET
        sha256=excluded.sha256,size_bytes=excluded.size_bytes,updated_at=now()'''),
        {'path':relative, 'digest':digest, 'size':os.path.getsize(physical)})


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
        client().download_file(private_bucket(), 'parish/' + info.sha256, str(tmp))
        if tmp.stat().st_size != info.size_bytes or file_digest(tmp) != info.sha256:
            raise RuntimeError('Stored file failed verification.')
        os.replace(tmp,cached)
    finally:
        tmp.unlink(missing_ok=True)
    return str(cached)
