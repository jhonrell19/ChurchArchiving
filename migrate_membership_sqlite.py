"""Backup-first additive migration for existing local Smart Parish SQLite accounts.
Usage: python migrate_membership_sqlite.py --apply
Never run against parish_auth Postgres or on the running server.
"""
from __future__ import annotations
import argparse
import sqlite3
from pathlib import Path
from datetime import datetime

parser=argparse.ArgumentParser()
parser.add_argument('--apply',action='store_true')
parser.add_argument('--db',default='dev.db')
args=parser.parse_args()
p=Path(args.db).resolve()
if not p.is_file(): raise SystemExit(f'Expected SQLite database missing: {p}')
with sqlite3.connect(f'file:{p.as_posix()}?mode=ro',uri=True) as c:
    integrity=c.execute('PRAGMA integrity_check').fetchone()[0]
    if integrity!='ok': raise SystemExit(f'DB integrity failed: {integrity}')
    tables={x[0] for x in c.execute('SELECT name FROM sqlite_master WHERE type="table"')}
    if 'User' not in tables: raise SystemExit('User table missing; check --db path.')
    columns={x[1] for x in c.execute('PRAGMA table_info("User")')}
    print('AUTH DB INTEGRITY: OK')
    print('Account rows:',c.execute('SELECT COUNT(*) FROM "User"').fetchone()[0])
    print('Approval fields:', sorted(x for x in columns if x.startswith('membership')))
if not args.apply:
    print('READ-ONLY CHECK COMPLETE. Run with --apply while apps stopped.')
    raise SystemExit(0)
backupdir=Path.home()/'SmartParish-Migration-Backup'/'membership-approval'
backupdir.mkdir(parents=True,exist_ok=True)
backup=backupdir/f'{p.name}.{datetime.now():%Y%m%d-%H%M%S}.backup'
if backup.exists(): raise SystemExit('Backup target exists. Retry in a moment.')
with sqlite3.connect(f'file:{p.as_posix()}?mode=ro',uri=True) as src, sqlite3.connect(str(backup)) as dst:
    src.backup(dst)
with sqlite3.connect(f'file:{backup.as_posix()}?mode=ro',uri=True) as c:
    if c.execute('PRAGMA integrity_check').fetchone()[0]!='ok': raise SystemExit('Backup verification failed!')
print('BACKUP VERIFIED:',backup)
updates={
    'membershipStatus':'TEXT NOT NULL DEFAULT \'pending\'',
    'membershipReviewedAt':'DATETIME',
    'membershipReviewedById':'INTEGER',
    'membershipReviewReason':'TEXT',
}
with sqlite3.connect(str(p),timeout=10) as c:
    c.execute('BEGIN IMMEDIATE')
    columns={x[1] for x in c.execute('PRAGMA table_info("User")')}
    for col,sqltype in updates.items():
        if col not in columns:
            c.execute(f'ALTER TABLE "User" ADD COLUMN "{col}" {sqltype}')
    c.commit()
with sqlite3.connect(f'file:{p.as_posix()}?mode=ro',uri=True) as c:
    assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    print('MEMBERSHIP MIGRATION: PASS')
    print('Pending USER accounts:', c.execute('SELECT COUNT(*) FROM "User" WHERE role="USER" AND membershipStatus="pending"').fetchone()[0])
    print('Staff accounts are not subject to membership approval.')
