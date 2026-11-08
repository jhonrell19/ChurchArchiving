#!/usr/bin/env python3
"""Prisma migration-history inspector. Read-only; no migration is applied."""
from pathlib import Path
import sqlite3,sys
ROOT=Path(__file__).resolve().parents[1]
DB=ROOT/'dev.db'
MIG=ROOT/'prisma/migrations'
NAMES=sorted(p.name for p in MIG.glob('*/migration.sql')) if MIG.exists() else []
print('PRISMA BASELINE AUDIT (READ ONLY)')
print('Migration folders:',', '.join(NAMES) or '(missing)')
if not DB.exists():
 print('STOP: root dev.db not found. Check DATABASE_URL; do not create a new database.')
 sys.exit(2)
with sqlite3.connect(f'{DB.as_uri()}?mode=ro',uri=True) as c:
  integrity=c.execute('PRAGMA integrity_check').fetchone()[0]
  fk=c.execute('PRAGMA foreign_key_check').fetchall()
  if integrity!='ok' or fk:
    print('STOP: SQLite integrity or foreign key violations.', integrity, len(fk))
    sys.exit(2)
  tables={x[0] for x in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
  expected={'User','Session','EmailVerificationToken','PasswordResetToken'}
  if expected-tables:
    print('STOP: Missing tables:',', '.join(sorted(expected-tables)))
    sys.exit(2)
  required={'id','firstName','middleName','surname','phoneNumber','address','email','password','role','emailVerified','googleSub','createdAt','updatedAt'}
  cols={r[1] for r in c.execute('PRAGMA table_info("User")')}
  if required-cols:
    print('STOP: User columns missing:',', '.join(sorted(required-cols)))
    sys.exit(2)
  print('PASS: Current User schema columns, expected tables, integrity and foreign keys')
  if '_prisma_migrations' in tables:
    print('Migration history exists; inspect `npx prisma migrate status` before any action.')
  else:
    print('No _prisma_migrations history. DO NOT replay older table-rebuilding migrations.')
    print('Before baselining: backup; run `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` and review the output.')
    print('If the schemas are equivalent, use the Prisma ORM v7 baselining procedure (migration resolve --applied) with an approved migration history.')
print('AUDIT COMPLETE: source database has not been modified.')
