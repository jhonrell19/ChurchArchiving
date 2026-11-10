#!/usr/bin/env python3
"""Backup-first, additive PayMongo financial ledger migration; NO request rows updated.

Run without --apply first. Stop Flask before applying and retain backups.
"""
from __future__ import annotations
import argparse
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
import os
import sqlite3
import sys

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / 'church_backend' / 'instance' / 'archive.db'

SQL = """CREATE TABLE IF NOT EXISTS paymongo_verified_payment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_payment_id TEXT NOT NULL UNIQUE,
  checkout_session_id TEXT NOT NULL UNIQUE,
  request_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'PHP',
  livemode INTEGER NOT NULL CHECK(livemode IN (0, 1)),
  verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(request_id) REFERENCES certificate_request(id)
);
CREATE INDEX IF NOT EXISTS ix_paymongo_verified_payment_request_id
  ON paymongo_verified_payment(request_id);"""


def migrate(database: Path, apply: bool, backup_dir: Path | None = None):
    if not database.is_file():
        raise RuntimeError('Archive database not found; will NOT create it: ' + str(database))
    with closing(sqlite3.connect(f'{database.as_uri()}?mode=ro', uri=True)) as read:
        if read.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('Archive database integrity check failed')
        tables = {r[0] for r in read.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if 'certificate_request' not in tables:
            raise RuntimeError('Unexpected database: missing certificate_request table')
        present = 'paymongo_verified_payment' in tables
        if present:
            cols = {r[1] for r in read.execute('PRAGMA table_info(paymongo_verified_payment)')}
            if not {'provider_payment_id','checkout_session_id','request_id','amount_cents','currency','livemode','verified_at'} <= cols:
                raise RuntimeError('Existing financial ledger schema differs; manual review required')
    print('Financial ledger:', 'PRESENT' if present else 'MISSING')
    if not apply:
        print('DRY RUN ONLY. No source or database changes.')
        return
    if present:
        print('PASS: already installed; no changes made.')
        return
    backups = backup_dir or ROOT.parent / 'smartparish_database_backups'
    backups.mkdir(parents=True, exist_ok=True)
    backup = backups / ('archive_before_payment_ledger_' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.db')
    with closing(sqlite3.connect(database)) as source, closing(sqlite3.connect(backup)) as target:
        source.backup(target)
    if os.name != 'nt': backup.chmod(0o600)
    print('BACKUP CREATED:', backup)
    with closing(sqlite3.connect(database)) as db, db:
        db.execute('PRAGMA foreign_keys=ON')
        try:
            db.executescript('BEGIN IMMEDIATE;\n' + SQL + '\nCOMMIT;')
        except Exception:
            db.rollback()
            raise
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise RuntimeError('Post-migration integrity check failed; use external backup and stop')
    print('PASS: financial ledger created; existing rows preserved.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--database', type=Path, default=DEFAULT_DB)
    parser.add_argument('--backup-dir', type=Path)
    args = parser.parse_args()
    try:
        migrate(args.database.resolve(), args.apply, args.backup_dir)
    except (sqlite3.Error, RuntimeError, OSError) as ex:
        print('STOP:', ex)
        sys.exit(2)
if __name__ == '__main__':
    main()
