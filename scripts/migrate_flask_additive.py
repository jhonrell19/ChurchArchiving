#!/usr/bin/env python3
"""Explicit, backup-first SQLite archive migration for Smart Parish.

No deletions, no UPDATE statements, no rows rewritten.  --apply required.
Run after stopping Flask. Backups are outside the repository.
"""
import argparse
from datetime import datetime, timezone
import os
from pathlib import Path
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / 'church_backend' / 'instance' / 'archive.db'
BACKUPS = ROOT.parent / 'smartparish_database_backups'

REQUEST_COLUMNS = {
    'requester_user_id':'INTEGER',
    'requester_address':'VARCHAR(500)',
    'is_urgent':'BOOLEAN NOT NULL DEFAULT 0',
    'base_fee':'INTEGER NOT NULL DEFAULT 0',
    'urgent_fee':'INTEGER NOT NULL DEFAULT 0',
    'total_fee':'INTEGER NOT NULL DEFAULT 0',
    'payment_status':"VARCHAR(30) NOT NULL DEFAULT 'Unpaid'",
    'payment_method':'VARCHAR(50)',
    'payment_reference':'VARCHAR(100)',
    'paid_at':'DATETIME',
    'record_date_hint':'VARCHAR(100)',
    'record_details':'VARCHAR(500)',
    'draft_file':'VARCHAR(500)',
    'history_hidden':'BOOLEAN NOT NULL DEFAULT 0',
}
DOCUMENT_COLUMNS = {
    'file_hash':'VARCHAR(200)',
    'department':'VARCHAR(100)',
    'ocr_text':'TEXT',
    'extracted_metadata':'TEXT',
    'record_data':'TEXT',
}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--apply', action='store_true', help='Back up and apply additive DDL; otherwise preview only')
    args=p.parse_args()
    if os.getenv('ARCHIVE_DATABASE_URL'):
        print('STOP: ARCHIVE_DATABASE_URL override exists. Verify actual database path before using this local-DB tool.')
        return 2
    if not DB.is_file():
        print('STOP: archive.db is missing; refusing to create a new database.')
        return 2
    # SQLite readonly inspection prevents accidental database creation.
    with sqlite3.connect(f'{DB.as_uri()}?mode=ro', uri=True) as c:
        if c.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            print('STOP: database integrity check failed.')
            return 2
        if c.execute('PRAGMA foreign_key_check').fetchall():
            print('STOP: foreign key violations detected.')
            return 2
        changes=[]
        for table, columns in (('certificate_request',REQUEST_COLUMNS),('document',DOCUMENT_COLUMNS)):
            exists=c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",(table,)).fetchone()
            if not exists:
                print(f'STOP: missing table {table}; do not use this upgrade script on an empty database.')
                return 2
            existing={row[1] for row in c.execute(f'PRAGMA table_info("{table}")')}
            for col, definition in columns.items():
                if col not in existing:
                    changes.append((table,col,definition))
        print(f'Archive DB exists; SQLite integrity OK; pending ADD COLUMN operations: {len(changes)}')
        for table,col,_ in changes:
            print(f'  + {table}.{col}')
    if not changes:
        with sqlite3.connect(f'{DB.as_uri()}?mode=ro', uri=True) as check:
            indices = {row[0] for row in check.execute("SELECT name FROM sqlite_master WHERE type='index'")}
        if {'ix_certificate_request_requester_user_id','ix_document_file_hash'} <= indices:
            print('PASS: additive schema and indexes are already up to date; no changes needed.')
            return 0
    if not args.apply:
        print('DRY RUN ONLY: no files changed. Stop Flask; then rerun with --apply to execute.')
        return 0
    BACKUPS.mkdir(parents=True, exist_ok=True)
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup=BACKUPS / f'archive_pre_additive_{stamp}.db'
    if backup.exists():
        print('STOP: backup name collision.')
        return 2
    with sqlite3.connect(str(DB)) as source, sqlite3.connect(str(backup)) as dest:
        source.backup(dest)
        if dest.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('Backup failed validation; original database left unchanged')
    print(f'BACKUP CREATED: {backup}')
    try:
        with sqlite3.connect(str(DB), timeout=20) as conn:
            conn.execute('PRAGMA foreign_keys=ON')
            conn.execute('BEGIN IMMEDIATE')
            for table,col,definition in changes:
                conn.execute(f'ALTER TABLE "{table}" ADD COLUMN "{col}" {definition}')
            conn.execute('CREATE INDEX IF NOT EXISTS ix_certificate_request_requester_user_id ON certificate_request(requester_user_id)')
            conn.execute('CREATE INDEX IF NOT EXISTS ix_document_file_hash ON document(file_hash)')
        with sqlite3.connect(f'{DB.as_uri()}?mode=ro',uri=True) as check:
            if check.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or check.execute('PRAGMA foreign_key_check').fetchall():
                raise RuntimeError('Post-migration database validation failed. Stop; restore verified backup before startup.')
        print('PASS: additive schema migration completed and database verified. No rows were deleted or rewritten.')
        return 0
    except Exception:
        print(f'ERROR: migration did not finish. Backup retained at {backup}. Inspect before restarting.')
        raise

if __name__=='__main__':sys.exit(main())
