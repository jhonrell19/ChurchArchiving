#!/usr/bin/env python3
"""Additive SQLite migration for staff MFA and optional phone OTP.

Dry-run by default. Requires existing root dev.db and an existing User/Session schema.
Never replays the old Prisma migrations or deletes user accounts.
"""
import argparse
import datetime
import sqlite3
from contextlib import closing
from pathlib import Path

TABLES = {
    'StaffMfa': [
        '"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT',
        '"userId" INTEGER NOT NULL UNIQUE',
        '"secretEncrypted" TEXT NOT NULL',
        '"recoveryCodesJson" TEXT NOT NULL',
        '"lastUsedStep" INTEGER NOT NULL DEFAULT -1',
        '"confirmedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        '"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        'FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE',
    ],
    'StaffMfaChallenge': [
        '"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT',
        '"userId" INTEGER NOT NULL',
        '"tokenHash" TEXT NOT NULL UNIQUE',
        '"setupSecretEncrypted" TEXT',
        '"attempts" INTEGER NOT NULL DEFAULT 0',
        '"expiresAt" DATETIME NOT NULL',
        '"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        'FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE',
    ],
    'PhoneVerification': [
        '"id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT',
        '"userId" INTEGER NOT NULL UNIQUE',
        '"phoneNumber" TEXT NOT NULL',
        '"otpHash" TEXT',
        '"expiresAt" DATETIME',
        '"lastSentAt" DATETIME',
        '"sendWindowStart" DATETIME',
        '"sendsInWindow" INTEGER NOT NULL DEFAULT 0',
        '"attempts" INTEGER NOT NULL DEFAULT 0',
        '"verifiedAt" DATETIME',
        '"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        '"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP',
        'FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE',
    ],
}
INDEXES = [
    'CREATE INDEX IF NOT EXISTS "StaffMfaChallenge_userId_idx" ON "StaffMfaChallenge" ("userId")',
    'CREATE INDEX IF NOT EXISTS "StaffMfaChallenge_expiresAt_idx" ON "StaffMfaChallenge" ("expiresAt")',
]

def ensure_valid(conn):
    if conn.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
        raise RuntimeError('SQLite integrity check failed.')
    names = {x[0] for x in conn.execute('SELECT name FROM sqlite_master WHERE type="table"')}
    if not {'User', 'Session'}.issubset(names):
        raise RuntimeError('Expected Prisma User and Session tables are missing. Wrong database?')
    return names

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--db', type=Path, default=Path(__file__).resolve().parent.parent / 'dev.db')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    dbpath = args.db.expanduser().resolve()
    if not dbpath.is_file(): raise SystemExit(f'MISSING database: {dbpath} (nothing changed)')
    with closing(sqlite3.connect(dbpath)) as conn:
        conn.execute('PRAGMA foreign_keys=ON')
        existing = ensure_valid(conn)
        for name, fields in TABLES.items():
            if name in existing:
                columns = {r[1] for r in conn.execute(f'PRAGMA table_info("{name}")')}
                expected = {field.split('"')[1] for field in fields if field.startswith('"')}
                if not expected.issubset(columns):
                    raise RuntimeError(f'Table {name} has a conflicting schema. Stop; do not overwrite it.')
        missing = [name for name in TABLES if name not in existing]
        print('Security tables missing:', ', '.join(missing) if missing else 'none')
        if not args.apply:
            print('DRY RUN ONLY. Source files and database unchanged. Stop Next.js before --apply.')
            return
        if not missing:
            print('PASS: Security tables already exist; nothing changed.')
            return
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        backups = dbpath.parent.parent / f'{dbpath.parent.name}_database_backups'
        backups.mkdir(parents=True, exist_ok=True)
        backup_file = backups / f'dev_before_account_security_{stamp}.db'
        with closing(sqlite3.connect(backup_file)) as dst:
            conn.backup(dst)
        print('BACKUP CREATED:', backup_file)
        try:
            conn.execute('BEGIN IMMEDIATE')
            for name in missing:
                sql = f'CREATE TABLE "{name}" ({", ".join(TABLES[name])})'
                conn.execute(sql)
            for sql in INDEXES: conn.execute(sql)
            # Force existing staff sessions to sign in again with their newly required MFA.
            revoked = conn.execute("DELETE FROM \"Session\" WHERE \"userId\" IN (SELECT \"id\" FROM \"User\" WHERE \"role\" IN (\'ADMIN\', \'BURIAL_ADMIN\'))").rowcount
            if conn.execute('PRAGMA foreign_key_check').fetchall(): raise RuntimeError('Foreign key check failed.')
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        print(f'PASS: additive security tables created; user accounts preserved; {revoked} old staff session(s) revoked.')

if __name__ == '__main__': main()
