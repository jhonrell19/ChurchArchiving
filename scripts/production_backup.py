#!/usr/bin/env python3
"""Create encrypted-offsite-ready SQLite consistent snapshots and file archive.
Copies are NOT encrypted; protect this directory and move it to encrypted offsite storage.
Run as the deployment service user with filesystem read access; never within Git.
"""
from datetime import datetime, timezone
from pathlib import Path
import argparse, os, sqlite3, tarfile

def backup_sqlite(source: Path, dest: Path):
    if not source.is_file(): raise FileNotFoundError(source)
    with sqlite3.connect(f'{source.as_uri()}?mode=ro', uri=True) as original, sqlite3.connect(dest) as target:
        original.backup(target)
        if target.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('Backed-up SQLite database failed integrity check: ' + source.name)
    if os.name != 'nt': dest.chmod(0o600)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--prisma-db', type=Path, required=True)
    parser.add_argument('--archive-db', type=Path, required=True)
    parser.add_argument('--uploads-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    args=parser.parse_args()
    for src in (args.prisma_db,args.archive_db):
        if not src.is_file():raise FileNotFoundError(src)
    if not args.uploads_dir.is_dir():raise FileNotFoundError(args.uploads_dir)
    output=args.output_dir.resolve()
    if output.is_relative_to(args.uploads_dir.resolve()) or output.is_relative_to(args.prisma_db.resolve().parent):
        raise RuntimeError('Backup output must be outside active uploads/database folders')
    run=output / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    run.mkdir(parents=True,exist_ok=False)
    if os.name!='nt':run.chmod(0o700)
    backup_sqlite(args.prisma_db.resolve(), run/'prisma.db')
    backup_sqlite(args.archive_db.resolve(),run/'archive.db')
    with tarfile.open(run/'uploads.tar.gz','w:gz') as tf:
        tf.add(args.uploads_dir.resolve(),arcname='uploads',recursive=True)
    if os.name!='nt':(run/'uploads.tar.gz').chmod(0o600)
    print('Backup completed. Files, DBs and uploads preserved in private directory:',run)
    print('ACTION REQUIRED: encrypt and copy this snapshot off the server; test restore periodically.')
if __name__=='__main__':main()
