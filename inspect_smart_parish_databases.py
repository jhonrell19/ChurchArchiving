from pathlib import Path
import os
import re
import sqlite3
import urllib.parse

ROOT = Path.cwd()


def read_database_url():
    value = os.environ.get("DATABASE_URL")
    if value:
        return value.strip().strip('"').strip("'")
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or not line.startswith("DATABASE_URL="):
                continue
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def candidates_from_url(url):
    if not url or not url.startswith("file:"):
        return []
    raw = url[5:].split("?", 1)[0]
    if raw in (":memory:", ""):
        return []
    p = Path(urllib.parse.unquote(raw.replace("/", os.sep)))
    if p.is_absolute():
        return [p]
    # Prisma SQLite file URLs are normally resolved relative to the schema file.
    return [ROOT / "prisma" / p, ROOT / p]


def inspect_db(label, path, expected_tables=()):
    path = Path(path)
    print(f"\n=== {label} ===")
    print(f"Path: {path.resolve()}")
    print(f"Exists: {path.is_file()}")
    if not path.is_file():
        return
    uri = path.resolve().as_uri() + "?mode=ro"
    try:
        con = sqlite3.connect(uri, uri=True, timeout=5)
        con.row_factory = sqlite3.Row
        integrity = con.execute("PRAGMA integrity_check").fetchone()[0]
        print(f"Integrity check: {integrity}")
        tables = [r[0] for r in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )]
        print("Tables:", ", ".join(tables) if tables else "(none)")
        for table in expected_tables:
            if table not in tables:
                print(f"  {table}: MISSING")
                continue
            cols = [r[1] for r in con.execute(f'PRAGMA table_info("{table}")')]
            count = con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            print(f"  {table}: {count} rows; columns: {', '.join(cols)}")
        if "_prisma_migrations" in tables:
            rows = con.execute(
                'SELECT migration_name, finished_at, rolled_back_at, applied_steps_count '
                'FROM "_prisma_migrations" ORDER BY started_at'
            ).fetchall()
            print("Prisma migration history:")
            for row in rows:
                state = "rolled back" if row["rolled_back_at"] else ("applied" if row["finished_at"] else "incomplete")
                print(f"  {row['migration_name']}: {state}; steps={row['applied_steps_count']}")
        else:
            print("Prisma migration history: _prisma_migrations table NOT FOUND")
        fk_errors = list(con.execute("PRAGMA foreign_key_check"))
        print(f"Foreign-key check: {len(fk_errors)} violation(s)")
        con.close()
    except Exception as exc:
        print(f"READ-ONLY INSPECTION ERROR: {type(exc).__name__}: {exc}")


url = read_database_url()
print("Smart Parish database diagnostic (READ-ONLY; does not modify database files)")
print("Project root:", ROOT)
print("DATABASE_URL:", (url.split("?", 1)[0] if url else "not found in process environment or .env"))
prisma_candidates = candidates_from_url(url)
if not prisma_candidates:
    prisma_candidates = [ROOT / "prisma" / "dev.db", ROOT / "dev.db"]
seen = set()
for i, path in enumerate(prisma_candidates, 1):
    resolved = path.resolve()
    if resolved in seen:
        continue
    seen.add(resolved)
    inspect_db(f"Prisma SQLite candidate {i}", path,
               expected_tables=("User", "Session", "EmailVerificationToken", "PasswordResetToken"))

inspect_db("Flask archive database", ROOT / "church_backend" / "instance" / "archive.db",
           expected_tables=("document", "certificate_request", "mass_record", "cemetery_slot",
                            "cemetery_reservation", "cemetery_payment", "burial_record",
                            "announcement", "audit_log"))
