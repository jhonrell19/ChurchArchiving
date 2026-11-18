"""Smart Parish: safe, one-time SQLite archive -> empty Supabase PostgreSQL.

This script does NOT migrate the separate Prisma auth database, physical files,
Supabase Auth users, or the proposed Phase-2 schema. It preserves IDs and raw
file paths for a staged cutover. No secrets are printed or stored.

Requirements: pip install "SQLAlchemy>=2,<3" "psycopg[binary]>=3,<4"

Preflight (read-only):
    python 01_migrate_archive.py --source church_backend/instance/archive.db

Import to an EMPTY PostgreSQL public schema (writes only to the target):
    $env:ARCHIVE_POSTGRES_URL="postgresql+psycopg://..."  # keep private
    python 01_migrate_archive.py --source church_backend/instance/archive.db --apply

Verify without writes:
    python 01_migrate_archive.py --source church_backend/instance/archive.db --verify

STOP all app processes and take separately stored SQLite + uploads backups before --apply.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import sqlite3
from urllib.parse import quote

from sqlalchemy import Boolean, DateTime, MetaData, create_engine, func, inspect, select, text
from sqlalchemy.schema import DefaultClause
from sqlalchemy.sql.sqltypes import DATETIME as ReflectedDATETIME
from sqlalchemy.engine import URL, make_url
from sqlalchemy.sql.sqltypes import Integer

# Explicit allow-list: fail on missing tables; ignore unrecognized tables until reviewed.
TARGET_SCHEMA = "parish_private"  # Not exposed through Supabase Data API.

ARCHIVE_TABLES = {
    "document", "audit_log", "certificate_request", "mass_record",
    "announcement", "cemetery_slot", "cemetery_reservation", "cemetery_payment",
    "burial_record", "certificate_fee_settings", "paymongo_verified_payment",
}


def sqlite_engine_readonly(path: Path):
    if not path.is_file():
        raise SystemExit(f"SQLite source does not exist: {path}")
    # quote the path to handle spaces and Windows paths; force filesystem read-only.
    uri = "file:" + quote(path.resolve().as_posix(), safe="/:") + "?mode=ro"

    def connect():
        con = sqlite3.connect(uri, uri=True, timeout=15)
        con.execute("PRAGMA query_only = 1")
        return con

    return create_engine("sqlite://", creator=connect)


def destination_engine():
    url = os.environ.get("ARCHIVE_POSTGRES_URL", "").strip()
    if not url:
        raise SystemExit("Set ARCHIVE_POSTGRES_URL in your own terminal. Do not paste it into chat.")
    parsed: URL = make_url(url)
    if parsed.drivername != "postgresql+psycopg":
        raise SystemExit("ARCHIVE_POSTGRES_URL must start with postgresql+psycopg://")
    if not parsed.host:
        raise SystemExit("ARCHIVE_POSTGRES_URL has no database hostname.")
    # Require encrypted transport; do not accidentally negotiate plaintext.
    return create_engine(url, connect_args={"sslmode": "require"}, pool_pre_ping=True)


def source_metadata(source):
    with source.connect() as conn:
        integrity = conn.exec_driver_sql("PRAGMA integrity_check").scalar_one()
        if integrity != "ok":
            raise SystemExit("Source SQLite failed integrity_check. Stop and restore a verified backup.")
        found = {row[0] for row in conn.exec_driver_sql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )}
        missing = ARCHIVE_TABLES - found
        if missing:
            raise SystemExit("Source archive is missing required tables: " + ", ".join(sorted(missing)))
        extra = found - ARCHIVE_TABLES
        if extra:
            raise SystemExit("Unrecognized source tables; review before migrating: " + ", ".join(sorted(extra)))
    md = MetaData()
    md.reflect(bind=source, only=sorted(ARCHIVE_TABLES))
    # SQLite-reflected DATETIME compiles as an invalid PostgreSQL DATETIME.
    # Convert to portable SQLAlchemy TIMESTAMP before emitting PostgreSQL DDL.
    for table in md.tables.values():
        for column in table.columns:
            if isinstance(column.type, ReflectedDATETIME):
                column.type = DateTime(timezone=False)
            # SQLite accepts BOOLEAN DEFAULT 0; PostgreSQL requires FALSE.
            if isinstance(column.type, Boolean) and column.server_default is not None:
                raw = str(column.server_default.arg).strip("()' ")
                if raw in {"0", "1"}:
                    column.server_default = DefaultClause(text("TRUE" if raw == "1" else "FALSE"))
            # Preserve TEXT storage for the original fee-table timestamp.
            if table.name == "certificate_fee_settings" and column.name == "updated_at":
                column.server_default = DefaultClause(text("CURRENT_TIMESTAMP::text"))
    return md


def read_counts(engine, md, *, is_target=False):
    with engine.connect() as conn:
        if is_target:
            conn.exec_driver_sql(f"SET search_path TO {TARGET_SCHEMA}, public")
        return {tbl.name: conn.scalar(select(func.count()).select_from(tbl)) for tbl in md.sorted_tables}


def verify(source, target, md):
    existing = set(inspect(target).get_table_names(schema=TARGET_SCHEMA))
    missing = ARCHIVE_TABLES - existing
    if missing:
        raise SystemExit("PostgreSQL private schema missing archive tables: " + ", ".join(sorted(missing)))
    src_counts = read_counts(source, md)
    pg_counts = read_counts(target, md, is_target=True)
    for name in sorted(ARCHIVE_TABLES):
        ok = src_counts[name] == pg_counts[name]
        print(f"{name:30} SQLite={src_counts[name]:5} PostgreSQL={pg_counts[name]:5} {'OK' if ok else 'MISMATCH'}")
    if src_counts != pg_counts:
        raise SystemExit("Some table counts differ. Keep SQLite as the system of record and investigate.")
    print("PASS: row counts match. Still test IDs, foreign keys, payment history, and app workflows before cutover.")


def apply(source, target, md):
    existing = set(inspect(target).get_table_names(schema=TARGET_SCHEMA))
    collisions = ARCHIVE_TABLES & existing
    if collisions:
        raise SystemExit("REFUSED: Destination private schema already has archive tables (no overwrite/upsert): " + ", ".join(sorted(collisions)))

    with source.connect() as sqlite, target.begin() as pg:
        # Preserve sensitive records in a private schema, NOT exposed via PostgREST.
        pg.exec_driver_sql(f"CREATE SCHEMA IF NOT EXISTS {TARGET_SCHEMA}")
        pg.exec_driver_sql(f"REVOKE ALL ON SCHEMA {TARGET_SCHEMA} FROM PUBLIC")
        pg.exec_driver_sql(f"SET LOCAL search_path TO {TARGET_SCHEMA}, public")
        # Source snapshot assumes the local Flask/Next.js apps have been stopped.
        sqlite.exec_driver_sql("BEGIN")
        md.create_all(pg, checkfirst=False)
        for table in md.sorted_tables:
            original = sqlite.execute(select(table)).mappings()
            count = 0
            while True:
                batch = original.fetchmany(250)
                if not batch:
                    break
                pg.execute(table.insert(), [dict(row) for row in batch])
                count += len(batch)
            print(f"Copied {table.name}: {count} rows")

            # Set the PostgreSQL SERIAL sequence beyond copied legacy IDs.
            pk = list(table.primary_key.columns)
            if len(pk) == 1 and isinstance(pk[0].type, Integer):
                seq = pg.scalar(text("SELECT pg_get_serial_sequence(:table, :column)"), {
                    "table": f'{TARGET_SCHEMA}."{table.name}"', "column": pk[0].name,
                })
                if seq:
                    max_id = pg.scalar(select(func.max(pk[0])).select_from(table))
                    if max_id is not None:
                        pg.execute(text("SELECT setval(CAST(:seq AS regclass), :value, true)"), {
                            "seq": seq, "value": int(max_id),
                        })

    print(f"Import committed in PostgreSQL schema: {TARGET_SCHEMA}. Source SQLite was read-only.")
    print("NEXT: run --verify, then test the Flask application against PostgreSQL in a staging copy.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source", default="church_backend/instance/archive.db", type=Path)
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--apply", action="store_true", help="Actually import to an empty remote PostgreSQL schema")
    action.add_argument("--verify", action="store_true", help="Verify remote row counts without writes")
    args = parser.parse_args()

    source = sqlite_engine_readonly(args.source)
    try:
        md = source_metadata(source)
        counts = read_counts(source, md)
        print("Source SQLite integrity check: PASS")
        for name, count in sorted(counts.items()):
            print(f"{name:30} rows={count}")
        if not args.apply and not args.verify:
            print("PREFLIGHT ONLY: nothing written. For actual import, use --apply after backups and Supabase setup.")
            return
        target = destination_engine()
        try:
            if args.apply:
                apply(source, target, md)
            verify(source, target, md)
        finally:
            target.dispose()
    finally:
        source.dispose()


if __name__ == "__main__":
    main()
