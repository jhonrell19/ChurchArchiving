"""Back up both private schemas and indexed Supabase objects to a new private directory.

Configure libpq through PGHOST, PGDATABASE, PGUSER, PGPASSFILE and PGSSLMODE.
The operator supplies a private, encrypted destination outside the source repository.
Use verify independently after copying a completed backup to the restore host.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile


def checksum(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def verify(root):
    manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
    if manifest.get('version') != 1:
        raise ValueError('Unknown snapshot format.')
    files = manifest['files']
    if 'parish.dump' not in files:
        raise ValueError('Database archive is missing from manifest.')
    for name, digest in files.items():
        if name != 'parish.dump' and not re.fullmatch(r'objects/[a-f0-9]{64}', name):
            raise ValueError('Invalid snapshot entry.')
        file = root / name
        if not file.resolve().is_relative_to(root.resolve()) or not file.is_file() or checksum(file) != digest:
            raise ValueError('Snapshot content check failed.')
    return len(files)


def snapshot(destination):
    import psycopg
    if not os.environ.get('PGDATABASE') or not os.environ.get('PGHOST'):
        raise ValueError('Set an explicit PGHOST and PGDATABASE for the backup.')
    if destination.resolve().is_relative_to(Path(__file__).resolve().parents[1]):
        raise ValueError('Choose a private backup directory outside the repository.')
    destination.mkdir(mode=0o700, parents=True, exist_ok=True)
    temp = Path(tempfile.mkdtemp(prefix='.partial-', dir=destination))
    try:
        with psycopg.connect('') as connection:
            connection.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
            snap = connection.execute('SELECT pg_export_snapshot()').fetchone()[0]
            archive = temp / 'parish.dump'
            subprocess.run(['pg_dump','--no-password','--format=custom','--schema=parish_auth',
                            '--schema=parish_private','--strict-names','--snapshot='+snap,'--file='+str(archive)],check=True)
            manifest = {'version':1, 'files':{'parish.dump':checksum(archive)}}
            files = connection.execute('SELECT DISTINCT sha256 FROM parish_private.upload_object')
            client = None
            for (digest,) in files:
                if not re.fullmatch('[a-f0-9]{64}',digest):
                    raise ValueError('Invalid indexed object digest.')
                if client is None:
                    import boto3
                    endpoint=os.environ['PARISH_S3_ENDPOINT']
                    if not endpoint.startswith('https://'):
                        raise ValueError('Private object backups require HTTPS.')
                    bucket=os.environ['PARISH_S3_BUCKET']
                    if connection.execute('SELECT NOT public FROM storage.buckets WHERE id=%s',(bucket,)).fetchone() != (True,):
                        raise ValueError('Cannot confirm private bucket.')
                    client=boto3.client('s3',endpoint_url=endpoint,region_name=os.environ['PARISH_S3_REGION'],
                                        aws_access_key_id=os.environ['PARISH_S3_ACCESS_KEY'],aws_secret_access_key=os.environ['PARISH_S3_SECRET_KEY'])
                    (temp/'objects').mkdir(mode=0o700)
                name='objects/'+digest
                client.download_file(bucket,'parish/'+digest,str(temp/name))
                manifest['files'][name]=digest
        (temp/'manifest.json').write_text(json.dumps(manifest),encoding='utf-8')
        verify(temp)
        stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        completed=destination/('parish-'+stamp)
        temp.rename(completed)
        return completed
    finally:
        if temp.exists():
            shutil.rmtree(temp)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['create','verify'])
    parser.add_argument('directory',type=Path)
    args=parser.parse_args()
    if args.action=='create':
        print('Verified snapshot:',snapshot(args.directory))
    else:
        print('Verified files:',verify(args.directory))
