"""Compare stopped official SQLite databases to their imported PostgreSQL schemas.
Default rehearses the full transaction then rolls back. --apply commits.
Only missing rows and newly added review fields are copied. Conflicts stop both schemas.
"""
import argparse
from contextlib import ExitStack
from datetime import datetime, timezone
from pathlib import Path
import os
import sqlite3

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError

ROOT = Path(__file__).resolve().parents[1]
TABLES = {
    'parish_auth': 'User Session EmailVerificationToken PasswordResetToken StaffMfa StaffMfaChallenge PhoneVerification'.split(),
    'parish_private': ('document audit_log certificate_request mass_record announcement cemetery_slot '
                      'cemetery_reservation cemetery_payment burial_record certificate_fee_settings paymongo_verified_payment').split(),
}
MEMBER = {'membershipStatus': "TEXT NOT NULL DEFAULT 'pending'", 'membershipReviewedAt': 'TIMESTAMP',
          'membershipReviewedById': 'INTEGER', 'membershipReviewReason': 'TEXT'}


def quoted(name):
    return '"' + name.replace('"', '""') + '"'


def normalized(value, kind):
    if value is None:
        return None
    if 'TIMESTAMP' in kind:
        if isinstance(value, int):
            value = datetime.fromtimestamp(value / 1000, timezone.utc)
        if isinstance(value, str):
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if not isinstance(value, datetime):
            raise ValueError('Unexpected timestamp encoding. Review the source before proceeding.')
        if value.tzinfo:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
    if kind == 'BOOLEAN':
        if value not in (0, 1):
            raise ValueError('Invalid source Boolean.')
        return bool(value)
    return value


def transfer(pg, src, schema, name):
    dest = quoted(schema) + '.' + quoted(name)
    qname = quoted(name)
    meta = inspect(pg)
    fields = {c['name']: str(c['type']) for c in meta.get_columns(name, schema=schema)}
    cols = [r[1] for r in src.execute(f'PRAGMA table_info({qname})')]
    added = set()
    if schema == 'parish_auth' and name == 'User':
        if not MEMBER.keys() <= set(cols):
            raise ValueError('Official User table lacks membership fields. Confirm the active auth source.')
        for key, ddl in MEMBER.items():
            if key not in fields:
                pg.exec_driver_sql(f'ALTER TABLE {dest} ADD COLUMN {quoted(key)} {ddl}')
                fields[key] = ddl
                added.add(key)
    if set(cols) != set(fields):
        raise ValueError(f'Column mismatch for {dest}: {sorted(set(cols) ^ set(fields))}')
    pk = meta.get_pk_constraint(name, schema=schema)['constrained_columns']
    local_pk = [r[1] for r in src.execute(f'PRAGMA table_info({qname})') if r[5]]
    if pk != local_pk or len(pk) != 1:
        raise ValueError(f'Primary key mismatch for {dest}')
    key = pk[0]
    cols_sql = ','.join(map(quoted, cols))
    marker = ','.join(':'+c for c in cols)
    new = total = 0
    for raw in src.execute(f'SELECT {cols_sql} FROM {qname} ORDER BY {quoted(key)}'):
        row = {c: normalized(v, fields[c]) for c, v in zip(cols, raw)}
        previous = pg.execute(text(f'SELECT {cols_sql} FROM {dest} WHERE {quoted(key)}=:pk'),
                              {'pk': row[key]}).mappings().first()
        if previous is None:
            pg.execute(text(f'INSERT INTO {dest} ({cols_sql}) VALUES ({marker})'), row)
            new += 1
        else:
            different = [c for c in cols if c not in added and row[c] != previous[c]]
            if different:
                raise ValueError(f'Both databases contain different values in {dest}, columns {different}. Review before switching.')
            if added:
                assignments = ','.join(f'{quoted(c)}=:{c}' for c in sorted(added))
                pg.execute(text(f'UPDATE {dest} SET {assignments} WHERE {quoted(key)}=:{key}'), row)
        total += 1
    if pg.scalar(text(f'SELECT count(*) FROM {dest}')) != total:
        raise ValueError(f'{dest} has records absent from the official source. Review before switching.')
    if total and key == 'id':
        seq = pg.scalar(text('SELECT pg_get_serial_sequence(:table,:key)'), {'table': dest, 'key': key})
        if not seq:
            raise ValueError(f'{dest} lacks an ID sequence.')
        maximum = pg.scalar(text(f'SELECT max("id") FROM {dest}'))
        # ALTER SEQUENCE RESTART rolls back with the import; never rewind a sequence.
        last, called = pg.exec_driver_sql(f'SELECT last_value,is_called FROM {seq}').one()
        if last < maximum or (last == maximum and not called):
            pg.exec_driver_sql(f'ALTER SEQUENCE {seq} RESTART WITH {int(maximum)+1}')
    print(f'{schema}.{name}: {total} matched after reconciliation, {new} missing rows copied in transaction.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--auth', type=Path, default=ROOT/'dev.db')
    parser.add_argument('--archive', type=Path, default=ROOT/'church_backend/instance/archive.db')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    load_dotenv(ROOT/'.env')
    url = make_url(os.environ['ARCHIVE_POSTGRES_URL'])
    if url.get_backend_name() != 'postgresql' or not url.host:
        raise ValueError('ARCHIVE_POSTGRES_URL must point to PostgreSQL.')
    engine = create_engine(url.set(drivername='postgresql+psycopg'), connect_args={'sslmode':'require','connect_timeout':10})
    with ExitStack() as stack:
        stack.callback(engine.dispose)
        pg = stack.enter_context(engine.connect())
        tx = pg.begin()
        pg.exec_driver_sql("SET LOCAL lock_timeout='8s'")
        for schema, path in [('parish_auth', args.auth), ('parish_private', args.archive)]:
            src = sqlite3.connect(path.resolve(strict=True).as_uri()+'?mode=ro', uri=True)
            stack.callback(src.close)
            src.execute('BEGIN')
            tables = {r[0] for r in src.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}
            if tables != set(TABLES[schema]) or src.execute('PRAGMA integrity_check').fetchone()[0] != 'ok' or src.execute('PRAGMA foreign_key_check').fetchone():
                raise ValueError(f'Unexpected or inconsistent SQLite source for {schema}.')
            for name in TABLES[schema]:
                pg.exec_driver_sql(f'LOCK TABLE {quoted(schema)}.{quoted(name)} IN SHARE ROW EXCLUSIVE MODE')
            for name in TABLES[schema]:
                transfer(pg, src, schema, name)
        orphan = pg.scalar(text('SELECT count(*) FROM parish_private.certificate_request r WHERE requester_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM parish_auth."User" u WHERE u.id=r.requester_user_id)'))
        if orphan:
            raise ValueError('Some certificate requests have no account owner.')
        if args.apply:
            tx.commit()
            print('COMMITTED: the two PostgreSQL schemas match the supplied official sources.')
        else:
            tx.rollback()
            print('REHEARSAL PASSED: all PostgreSQL changes rolled back.')


if __name__ == '__main__':
    try:
        main()
    except SQLAlchemyError as exc:
        # Driver messages may contain bound account data or the database URL.
        orig = getattr(exc, 'orig', None)
        diag = getattr(orig, 'diag', None)
        raise SystemExit(f"Stopped: {type(exc).__name__}, SQLSTATE {getattr(orig,'sqlstate',None)}, table {getattr(diag,'table_name',None)}, constraint {getattr(diag,'constraint_name',None)}. No transaction committed.") from None
