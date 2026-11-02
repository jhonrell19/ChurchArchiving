from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATABASES = [
    ("Prisma database", ROOT / "dev.db", [
        "User", "Session", "EmailVerificationToken", "PasswordResetToken", "_prisma_migrations"
    ]),
    ("Flask archive database", ROOT / "church_backend" / "instance" / "archive.db", [
        "document", "certificate_request", "mass_record", "cemetery_slot",
        "cemetery_reservation", "cemetery_payment", "burial_record", "announcement", "audit_log"
    ]),
]


def quote_ident(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def inspect(label: str, path: Path, targets: list[str]) -> None:
    print(f"\n{'=' * 76}\n{label}\nPath: {path}\nExists: {path.is_file()}")
    if not path.is_file():
        return
    uri = path.resolve().as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True, timeout=10) as con:
        con.row_factory = sqlite3.Row
        tables = {r[0] for r in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )}
        for table in targets:
            if table not in tables:
                print(f"\n[{table}] NOT PRESENT")
                continue
            ident = quote_ident(table)
            count = con.execute(f"SELECT COUNT(*) FROM {ident}").fetchone()[0]
            print(f"\n[{table}] rows={count}")
            for col in con.execute(f"PRAGMA table_info({ident})"):
                print(
                    "  COLUMN "
                    f"{col['name']} | type={col['type']} | notnull={col['notnull']} "
                    f"| default={col['dflt_value']} | pk={col['pk']}"
                )
            for fk in con.execute(f"PRAGMA foreign_key_list({ident})"):
                print(
                    "  FOREIGN KEY "
                    f"{fk['from']} -> {fk['table']}.{fk['to']} "
                    f"| on_delete={fk['on_delete']} | on_update={fk['on_update']}"
                )
            for idx in con.execute(f"PRAGMA index_list({ident})"):
                idx_name = idx['name']
                idx_ident = quote_ident(idx_name)
                cols = [r['name'] for r in con.execute(f"PRAGMA index_info({idx_ident})")]
                idx_sql_row = con.execute(
                    "SELECT sql FROM sqlite_master WHERE type='index' AND name=?", (idx_name,)
                ).fetchone()
                idx_sql = idx_sql_row['sql'] if idx_sql_row else "(autoindex)"
                print(f"  INDEX {idx_name} | unique={idx['unique']} | columns={cols} | {idx_sql}")
            create_sql_row = con.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)
            ).fetchone()
            if create_sql_row and create_sql_row['sql']:
                print("  CREATE SQL:")
                for line in create_sql_row['sql'].splitlines():
                    print("    " + line)
        fk_errors = list(con.execute("PRAGMA foreign_key_check"))
        print(f"\nForeign-key violations: {len(fk_errors)}")


def main() -> int:
    print("Smart Parish schema details (READ-ONLY; no row contents are printed)")
    print(f"Project root: {ROOT}")
    for label, path, targets in DATABASES:
        inspect(label, path, targets)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
