#!/usr/bin/env python3
"""Smart Parish read-only deployment preflight (Python 3.10+).
Run from project root. Does not print environment secret values or personal data.
Does not run migrations, install dependencies, or change files.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import sqlite3
import sys
from urllib.parse import urlparse

ROOT = Path.cwd()
checks: list[tuple[str, str, str]] = []


def check(level: str, name: str, explanation: str) -> None:
    checks.append((level, name, explanation))


def load_env(*files: Path) -> dict[str, str]:
    env = dict(os.environ)
    # Values never leave this process. Respect already-exported environment variables.
    for fp in files:
        if not fp.is_file():
            continue
        for line in fp.read_text(encoding='utf-8-sig', errors='replace').splitlines():
            line=line.strip()
            if not line or line.startswith('#'):
                continue
            if line.startswith('export '):
                line=line[7:]
            if '=' not in line:
                continue
            k,v=line.split('=',1)
            k=k.strip()
            if not k or k in env:
                continue
            v=v.strip().strip('"').strip("'")
            env[k]=v
    return env


def safe_sqlite(name: str, db_file: Path, required: dict[str, list[str]]) -> None:
    if not db_file.is_file():
        check('BLOCK',name, f'Database not found: {db_file.relative_to(ROOT) if db_file.is_relative_to(ROOT) else db_file}')
        return
    try:
        # Immutable prevents accidental writes; if a WAL exists, integrity output may be stale.
        con=sqlite3.connect('file:'+str(db_file.as_posix())+'?mode=ro',uri=True,timeout=3)
        try:
            integrity=con.execute('PRAGMA integrity_check').fetchone()[0]
            foreign=con.execute('PRAGMA foreign_key_check').fetchall()
            tables={r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            missing={t:[c for c in cols if c not in {r[1] for r in con.execute(f'PRAGMA table_info("{t}")')}] for t,cols in required.items() if t in tables}
            missing_tables=[t for t in required if t not in tables]
            missing_cols={t:cols for t,cols in missing.items() if cols}
            if integrity!='ok' or foreign or missing_tables or missing_cols:
                check('BLOCK',name,'Integrity/foreign-key/schema check failed; investigate before deployment (no records displayed).')
            else:
                check('PASS',name,'SQLite integrity and expected key columns verified (read-only).')
            if name.startswith('Prisma'):
                if '_prisma_migrations' not in tables:
                    check('BLOCK','Prisma migration baseline','_prisma_migrations is missing; reconcile/baseline on a verified backup before deploy.')
                else:
                    check('CHECK','Prisma migration status','History table exists; run npx prisma migrate status and compare schema before deploy.')
        finally:
            con.close()
    except Exception as exc:
        check('BLOCK',name,f'Could not inspect SQLite database ({type(exc).__name__}); verify DB path and permissions.')


def main():
    parser=argparse.ArgumentParser(description="Read-only Smart Parish deployment preflight")
    parser.add_argument("--mode", choices=("staging", "live"), default="staging", help="staging is for defense with TEST PayMongo; live requires actual payments")
    args=parser.parse_args()
    print(f"Smart Parish {args.mode} preflight — READ ONLY")
    print('Root:',ROOT)
    env=load_env(ROOT/'.env', ROOT/'.env.local')
    needed=['package.json','next.config.ts','prisma.config.ts','prisma/schema.prisma','church_backend/server.py','church_backend/models.py','church_backend/wsgi.py']
    missing=[p for p in needed if not (ROOT/p).is_file()]
    check('BLOCK' if missing else 'PASS','Project structure', 'Missing: '+', '.join(missing) if missing else 'Expected source files present.')

    required_env=['DATABASE_URL','APP_BASE_URL','FLASK_API_URL','FLASK_INTERNAL_KEY','FLASK_SECRET_KEY','GOOGLE_CLIENT_ID','NEXT_PUBLIC_GOOGLE_CLIENT_ID','RESEND_API_KEY','EMAIL_FROM','PAYMONGO_SECRET_KEY','PAYMONGO_WEBHOOK_SECRET']
    missing_vars=[k for k in required_env if not env.get(k,'').strip()]
    check('BLOCK' if missing_vars else 'PASS','Environment configuration', 'Missing variable names: '+', '.join(missing_vars) if missing_vars else 'Required variables present; values not displayed.')

    base=env.get('APP_BASE_URL','')
    basehost=(urlparse(base).hostname or '').lower()
    if not base.startswith('https://') or basehost in {'localhost','127.0.0.1'} or 'ngrok' in basehost:
        check('BLOCK','Public site URL','Set APP_BASE_URL to your real public HTTPS domain for a permanent deployment.')
    else:
        check('PASS','Public site URL','HTTPS domain configured (DNS/SSL not tested).')

    if env.get('GOOGLE_CLIENT_ID') and env.get('NEXT_PUBLIC_GOOGLE_CLIENT_ID'):
        check('PASS' if env['GOOGLE_CLIENT_ID']==env['NEXT_PUBLIC_GOOGLE_CLIENT_ID'] else 'BLOCK','Google client IDs', 'Server and browser IDs match.' if env['GOOGLE_CLIENT_ID']==env['NEXT_PUBLIC_GOOGLE_CLIENT_ID'] else 'Server and browser client IDs differ.')

    if env.get('FLASK_INTERNAL_KEY','').lower() in ('','dev','test','changeme','change-me','default') or len(env.get('FLASK_INTERNAL_KEY',''))<32:
        check('BLOCK','Backend private key','Set a random FLASK_INTERNAL_KEY at least 32 characters long; never expose it to the browser.')
    else:
        check('PASS','Backend private key','Configured with nontrivial length (strength not independently verified).')
    if env.get('FLASK_SECRET_KEY','').lower() in ('','dev-only-change-me','changeme','change-me','default') or len(env.get('FLASK_SECRET_KEY',''))<32:
        check('BLOCK','Flask secret','Set a random FLASK_SECRET_KEY at least 32 characters long.')
    else:
        check('PASS','Flask secret','Configured with nontrivial length.')
    check('BLOCK' if env.get('FLASK_DEBUG','').lower() in {'1','true','yes','on'} else 'PASS','Flask debug mode','Debug must be off in production.')

    if env.get('DATABASE_URL','').startswith('file:'):
        check('CHECK','SQLite persistence','Keep the Prisma SQLite database on a persistent mounted volume, not inside disposable image storage.')
    if env.get('ARCHIVE_DATABASE_URL','').startswith('sqlite') or not env.get('ARCHIVE_DATABASE_URL'):
        check('CHECK','Archive persistence','Keep archive.db, uploads, and generated documents on persistent volumes with tested off-site backups.')

    if env.get('PAYMONGO_SECRET_KEY','').startswith('sk_test_'):
        check('PASS' if args.mode == 'staging' else 'BLOCK','PayMongo mode','TEST key: fine for defense staging, but not for real payment collection.')
    elif env.get('PAYMONGO_SECRET_KEY','').startswith('sk_live_'):
        check('BLOCK','PayMongo mode','LIVE key detected; current source is TEST-ONLY. Do not collect real money until live-mode integration is updated and audited.')
    else:
        check('CHECK','PayMongo mode','Unknown/missing key mode; review configuration without sharing keys.')

    hook=ROOT/'src/app/api/paymongo/webhook/route.ts'
    backend=ROOT/'church_backend/server.py'
    if hook.is_file() and backend.is_file() and ('Only test mode supported' in hook.read_text(errors='ignore') or 'TEST secret key' in backend.read_text(errors='ignore')):
        check('CHECK' if args.mode == 'staging' else 'BLOCK','Live payments','Code currently rejects live mode. Sandbox only; do not collect real money without revising and testing live-mode processing.')

    for name,path in [('Baptism form','church_backend/templates/certificates/baptism_form.png'),('Confirmation form','church_backend/templates/certificates/confirmation_form.png'),('Marriage front','church_backend/templates/certificates/marriage_front.png'),('Marriage back','church_backend/templates/certificates/marriage_back.png'),('Cemetery map','church_backend/uploads/cemetery/site_master_plan_reference.png')]:
        check('PASS' if (ROOT/path).is_file() else 'CHECK',name,'Present.' if (ROOT/path).is_file() else f'Asset missing: {path}. Ensure it is included in persistent assets if used.')
    for exe in ('ffmpeg','tesseract'):
        check('PASS' if shutil.which(exe) else 'CHECK',exe,'Executable is in PATH.' if shutil.which(exe) else f'{exe} not found in PATH of this machine.')

    safe_sqlite('Prisma users DB',ROOT/'dev.db',{'User':['id','email','role','googleSub'],'Session':['id','userId'],'EmailVerificationToken':['id','userId']})
    safe_sqlite('Flask archive DB',ROOT/'church_backend/instance/archive.db',{'document':['id','filepath'],'certificate_request':['id','requester_user_id'],'mass_record':['id','filepath'],'cemetery_reservation':['id','slot_id']})
    print('\nRESULTS:')
    for level,name,details in checks:
        print(f'[{level:5}] {name}: {details}')
    print('\nCounts:', ' '.join(f'{tag}={sum(x[0]==tag for x in checks)}' for tag in ('PASS','CHECK','BLOCK')))
    print('CHECK = manual verification needed. BLOCK = must resolve before permanent/live deployment.')
    print('No migration, changes to DB, uploads, or secrets were performed.')
    return 1 if any(x[0]=='BLOCK' for x in checks) else 0

if __name__=='__main__':
    sys.exit(main())
