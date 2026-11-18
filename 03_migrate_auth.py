"""Smart Parish staging-only: SQLite Prisma auth -> Supabase PostgreSQL parish_auth.

Run from the project root with dev.db (never upload your dev.db):
  python 03_migrate_auth.py
  python 03_migrate_auth.py --apply --backups-verified
  python 03_migrate_auth.py --verify

The source is always read-only. Nothing is printed from user records, hashes,
MFA secrets, recovery codes or tokens. Writes only to a NEW private schema.
The script deliberately does not alter app config, Supabase Auth, or Phase-2 SQL.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import os
from pathlib import Path
import sqlite3
from urllib.parse import quote

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url

SCHEMA = 'parish_auth'
TYPES = {'Role': ('USER', 'ADMIN', 'BURIAL_ADMIN')}
# Ordered to satisfy foreign keys. Columns match the supplied Prisma schema.
FIELDS = {
 'User': {
  'id': 'id', 'firstName': 'text', 'middleName': 'text', 'surname': 'text',
  'phoneNumber': 'text', 'address': 'text', 'email': 'text',
  'password': 'text', 'role': 'role', 'emailVerified': 'bool',
  'googleSub': 'text', 'createdAt': 'date', 'updatedAt': 'date',
 },
 'Session': {'id':'id','tokenHash':'text','userId':'int','expiresAt':'date','createdAt':'date'},
 'EmailVerificationToken': {'id':'id','tokenHash':'text','userId':'int','expiresAt':'date','createdAt':'date'},
 'PasswordResetToken': {'id':'id','tokenHash':'text','userId':'int','expiresAt':'date','createdAt':'date'},
 'StaffMfa': {'id':'id','userId':'int','secretEncrypted':'text','recoveryCodesJson':'text',
             'lastUsedStep':'int','confirmedAt':'date','createdAt':'date'},
 'StaffMfaChallenge': {'id':'id','userId':'int','tokenHash':'text',
             'setupSecretEncrypted':'text','attempts':'int','expiresAt':'date','createdAt':'date'},
 'PhoneVerification': {'id':'id','userId':'int','phoneNumber':'text','otpHash':'text',
             'expiresAt':'date','lastSentAt':'date','sendWindowStart':'date',
             'sendsInWindow':'int','attempts':'int','verifiedAt':'date',
             'createdAt':'date','updatedAt':'date'},
}
REQUIRED = {
 'User': {'email', 'password', 'role', 'emailVerified', 'createdAt', 'updatedAt'},
 'Session': {'tokenHash','userId','expiresAt','createdAt'},
 'EmailVerificationToken': {'tokenHash','userId','expiresAt','createdAt'},
 'PasswordResetToken': {'tokenHash','userId','expiresAt','createdAt'},
 'StaffMfa': {'userId','secretEncrypted','recoveryCodesJson','lastUsedStep','confirmedAt','createdAt'},
 'StaffMfaChallenge': {'userId','tokenHash','attempts','expiresAt','createdAt'},
 'PhoneVerification': {'userId','phoneNumber','sendsInWindow','attempts','createdAt','updatedAt'},
}
UNIQUE = {'User': ('email', 'googleSub'), 'Session': ('tokenHash',),
          'EmailVerificationToken': ('tokenHash',), 'PasswordResetToken': ('tokenHash',),
          'StaffMfa': ('userId',), 'StaffMfaChallenge': ('tokenHash',),
          'PhoneVerification': ('userId',)}
FK_TABLES = set(FIELDS) - {'User'}
BOOL_FIELDS = {'User': {'emailVerified'}}
DEFAULTS = {('User','role'): "DEFAULT 'USER'", ('User','emailVerified'): 'DEFAULT false',
            ('StaffMfa','lastUsedStep'): 'DEFAULT -1',
            ('StaffMfaChallenge','attempts'): 'DEFAULT 0',
            ('PhoneVerification','sendsInWindow'): 'DEFAULT 0',
            ('PhoneVerification','attempts'): 'DEFAULT 0'}
DATE_DEFAULTS = {'createdAt','updatedAt','confirmedAt'}
INDEXED = {'Session': ('userId','expiresAt'),
           'EmailVerificationToken': ('userId','expiresAt'),
           'PasswordResetToken': ('userId','expiresAt'),
           'StaffMfaChallenge': ('userId','expiresAt')}

def q(value):
    assert value.replace('_', '').isalnum()
    return '"' + value + '"'

def read_source(path: Path):
    if not path.exists():
        raise SystemExit(f'Auth SQLite file not found: {path}')
    uri = 'file:' + quote(path.resolve().as_posix(), safe='/:') + '?mode=ro'
    db = sqlite3.connect(uri, uri=True)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA query_only=ON')
    if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
        raise SystemExit('Auth SQLite integrity check failed.')
    if db.execute('PRAGMA foreign_key_check').fetchone():
        raise SystemExit('Auth SQLite foreign-key check failed.')
    found = {row[0] for row in db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
    missing = set(FIELDS) - found
    if missing:
        raise SystemExit(f'Auth SQLite is missing tables: {sorted(missing)}')
    extra = found - set(FIELDS)
    if extra:
        raise SystemExit(f'Auth SQLite has unreviewed tables: {sorted(extra)}; update migration first.')
    for table, columns in FIELDS.items():
        actual = {row[1] for row in db.execute('PRAGMA table_info(' + q(table) + ')')}
        if actual != set(columns):
            raise SystemExit(f'{table} columns differ from reviewed Prisma schema; expected {sorted(columns)}; found {sorted(actual)}')
    roles = {row[0] for row in db.execute('SELECT DISTINCT "role" FROM "User"')}
    if not roles.issubset(TYPES['Role']):
        raise SystemExit('Unrecognized legacy role; review before migrating.')
    return db

def pg_engine():
    url = os.environ.get('ARCHIVE_POSTGRES_URL', '')
    if not url:
        raise SystemExit('ARCHIVE_POSTGRES_URL not set in the current terminal.')
    parsed = make_url(url)
    if parsed.drivername != 'postgresql+psycopg' or not parsed.host:
        raise SystemExit('Use a postgresql+psycopg:// Supabase connection.')
    return create_engine(url, connect_args={'sslmode':'require'}, pool_pre_ping=True)

def dt(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        d = value
    elif isinstance(value, str):
        d = datetime.fromisoformat(value.replace('Z','+00:00'))
    else:
        raise ValueError('Unsupported SQLite datetime encoding; stop and review.')
    if d.tzinfo:
        return d.astimezone(timezone.utc).replace(tzinfo=None)
    return d

def normalize(table, row):
    result = {}
    for col, kind in FIELDS[table].items():
        val = row[col]
        if kind == 'date':
            val = dt(val)
        elif kind == 'bool' and val is not None:
            val = bool(val)
        elif kind in ('id','int') and val is not None:
            val = int(val)
        result[col] = val
    return result

def ddl(pg):
    # Called only after confirmed absence of private target schema.
    pg.execute(text(f'CREATE SCHEMA {SCHEMA}'))
    pg.execute(text(f'REVOKE ALL ON SCHEMA {SCHEMA} FROM PUBLIC'))
    pg.execute(text(f'REVOKE ALL ON SCHEMA {SCHEMA} FROM anon, authenticated, service_role'))
    pg.execute(text(f'CREATE TYPE {SCHEMA}."Role" AS ENUM (\'USER\', \'ADMIN\', \'BURIAL_ADMIN\')'))
    for table, columns in FIELDS.items():
        lines = []
        for col, kind in columns.items():
            sqltype = {'id':'INTEGER GENERATED BY DEFAULT AS IDENTITY', 'int':'INTEGER',
                       'text':'TEXT', 'bool':'BOOLEAN', 'date':'TIMESTAMP(6)',
                       'role':f'{SCHEMA}."Role"'}[kind]
            nullable = ' NOT NULL' if col == 'id' or col in REQUIRED[table] else ''
            default = DEFAULTS.get((table, col),'')
            if kind == 'date' and col in DATE_DEFAULTS and col in REQUIRED[table]:
                default = 'DEFAULT CURRENT_TIMESTAMP'
            lines.append(f'{q(col)} {sqltype}{nullable} {default}'.rstrip())
        lines.append('PRIMARY KEY ("id")')
        if table in FK_TABLES:
            lines.append(f'CONSTRAINT {q(table+"_userId_fkey")} FOREIGN KEY ("userId") '
                         'REFERENCES parish_auth."User"("id") ON DELETE CASCADE ON UPDATE CASCADE')
        statement = f'CREATE TABLE {SCHEMA}.{q(table)} (\n  ' + ',\n  '.join(lines) + '\n)'
        pg.execute(text(statement))
        for col in UNIQUE.get(table,()):
            pg.execute(text(f'CREATE UNIQUE INDEX {q(table+"_"+col+"_key")} ON {SCHEMA}.{q(table)} ({q(col)})'))
        for col in INDEXED.get(table,()):
            pg.execute(text(f'CREATE INDEX {q(table+"_"+col+"_idx")} ON {SCHEMA}.{q(table)} ({q(col)})'))
    # No direct access from the browser's anon/authenticated roles, including table access.
    pg.execute(text(f'REVOKE ALL ON ALL TABLES IN SCHEMA {SCHEMA} FROM PUBLIC, anon, authenticated, service_role'))
    pg.execute(text(f'REVOKE ALL ON ALL SEQUENCES IN SCHEMA {SCHEMA} FROM PUBLIC, anon, authenticated, service_role'))

def insert_rows(src, pg):
    for table, columns in FIELDS.items():
        names = list(columns)
        sql_values = [f'CAST(:{name} AS parish_auth."Role")' if columns[name] == 'role' else f':{name}' for name in names]
        sql = f'INSERT INTO {SCHEMA}.{q(table)} (' + ', '.join(map(q,names)) + ') VALUES ('+ ', '.join(sql_values)+')'
        count = 0
        rows = src.execute(f'SELECT * FROM {q(table)} ORDER BY "id"')
        while True:
            batch = rows.fetchmany(100)
            if not batch: break
            pg.execute(text(sql), [normalize(table,row) for row in batch])
            count += len(batch)
        if count:
            pg.execute(text(f'SELECT setval(pg_get_serial_sequence(\'{SCHEMA}.{q(table)}\', \'id\'), '
                            f'(SELECT max("id") FROM {SCHEMA}.{q(table)}), true)'))
        print(f'Imported {table}: {count} rows')

def compare(src, pg):
    for table in FIELDS:
        srows = [normalize(table, r) for r in src.execute(f'SELECT * FROM {q(table)} ORDER BY "id"')]
        prows = [normalize(table, r) for r in pg.execute(text(f'SELECT * FROM {SCHEMA}.{q(table)} ORDER BY "id"')).mappings()]
        if srows != prows:
            raise SystemExit(f'VERIFY FAILED: {table} differs (contents or count); no values printed.')
        print(f'{table:26} SQLite={len(srows):4} PostgreSQL={len(prows):4} content=OK')
    if pg.scalar(text("SELECT to_regclass('parish_private.certificate_request')")) is not None:
        missing = pg.scalar(text('''SELECT count(*) FROM parish_private.certificate_request r
            WHERE r.requester_user_id IS NOT NULL AND NOT EXISTS
              (SELECT 1 FROM parish_auth."User" u WHERE u.id=r.requester_user_id)'''))
        if missing:
            raise SystemExit(f'{missing} certificate requests have no matching migrated user!')
        print('Archive request -> migrated user references: OK')
    print('PASS: auth content, IDs and archive ownership match. Staging app testing still required.')

def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--source', type=Path, default=Path('dev.db'))
    group = p.add_mutually_exclusive_group()
    group.add_argument('--apply',action='store_true')
    group.add_argument('--verify',action='store_true')
    p.add_argument('--backups-verified',action='store_true',help='Explicit acknowledgement of offline database and uploads backups')
    args = p.parse_args()
    src = read_source(args.source)
    try:
        print('AUTH PREFLIGHT: SQLite integrity, foreign keys, and reviewed columns PASS')
        for table in FIELDS:
            print(f'{table:26} rows={src.execute(f"SELECT count(*) FROM {q(table)}").fetchone()[0]}')
        if not args.apply and not args.verify:
            print('READ-ONLY PREFLIGHT: nothing written. Back up dev.db and archive.db before --apply.')
            return
        engine=pg_engine()
        try:
            with engine.connect() as pg:
                present = pg.scalar(text('SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname=:schema)'),{'schema':SCHEMA})
            if args.apply:
                if not args.backups_verified:
                    raise SystemExit('REFUSED: include --backups-verified only after checking offline copies of dev.db and archive.db.')
                if present:
                    raise SystemExit('REFUSED: target parish_auth schema already exists; never overwrite remote account records.')
                with engine.begin() as pg:
                    ddl(pg)
                    insert_rows(src,pg)
                print('STAGING AUTH IMPORT COMMITTED; SQLite remained read-only.')
            elif not present:
                raise SystemExit('No imported parish_auth schema found; run --apply only after backups.')
            with engine.connect() as pg:
                compare(src,pg)
        finally:
            engine.dispose()
    finally:
        src.close()

if __name__ == '__main__':
    main()
