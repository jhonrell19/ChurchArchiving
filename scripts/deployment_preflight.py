#!/usr/bin/env python3
"""Read-only deployment report. Does not print environment secrets or personal records."""
from pathlib import Path
from datetime import datetime
import argparse
import os
import shutil
import sqlite3
import sys

ROOT=Path(__file__).resolve().parents[1]
pass_count=0
warnings=0
fail_count=0

def log(kind, title, detail=''):
    global pass_count,warnings,fail_count
    if kind=='PASS':pass_count+=1
    elif kind=='WARN':warnings+=1
    else:fail_count+=1
    print(f'{kind}: {title}'+(f' — {detail}' if detail else ''))

def read_db(path,kind,required):
    if not path.exists():
        log('FAIL',f'{kind} database missing',str(path))
        return
    try:
        with sqlite3.connect(f'{path.as_uri()}?mode=ro',uri=True) as c:
            result=c.execute('PRAGMA integrity_check').fetchone()[0]
            fks=c.execute('PRAGMA foreign_key_check').fetchall()
            if result!='ok' or fks:
                log('FAIL',f'{kind} database integrity',f'integrity={result}; foreign-key violations={len(fks)}')
                return
            tables={r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            missing=required-tables
            if missing:
                log('FAIL',f'{kind} missing tables', ', '.join(sorted(missing)))
            else:
                log('PASS',f'{kind} SQLite integrity + expected tables')
            if kind=='Prisma':
                if '_prisma_migrations' not in tables:
                    log('WARN','Prisma migration baseline pending','Existing tables must be compared before migrate resolve/deploy')
                elif c.execute('SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL').fetchone()[0]==0:
                    log('WARN','No completed Prisma migrations recorded')
                user_cols={r[1] for r in c.execute('PRAGMA table_info("User")')}
                if {'googleSub','emailVerified','role','email','password'} - user_cols:
                    log('FAIL','Prisma User columns incomplete')
            if kind=='Flask':
                cols={r[1] for r in c.execute('PRAGMA table_info("certificate_request")')}
                if 'history_hidden' not in cols:
                    log('WARN','Flask additive migration pending','Run scripts/migrate_flask_additive.py --apply after backup')
                # No record names, emails, scanned filepaths or hashes are printed.
    except sqlite3.DatabaseError as e:
        log('FAIL',f'{kind} database unreadable',type(e).__name__)

def env_file_key(key):
    value=os.getenv(key,'').strip()
    if value:return value
    envpath=ROOT/'.env'
    if envpath.exists():
        for line in envpath.read_text(encoding='utf-8-sig',errors='replace').splitlines():
            if line.strip().startswith('#') or '=' not in line: continue
            k,v=line.split('=',1)
            if k.strip()==key:return v.strip().strip('"').strip("'")
    return ''

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode',choices=['defense','production'],default='defense')
    args=parser.parse_args()
    strict=args.mode=='production'
    print('SMART PARISH READ-ONLY PREFLIGHT | '+args.mode.upper())
    for path in [ROOT/'package.json',ROOT/'prisma/schema.prisma',ROOT/'church_backend/server.py',ROOT/'church_backend/templates/certificates/baptism_form.png',ROOT/'church_backend/templates/certificates/confirmation_form.png',ROOT/'church_backend/templates/certificates/marriage_front.png',ROOT/'church_backend/templates/certificates/marriage_back.png']:
        log('PASS' if path.exists() else 'FAIL', f'Project asset: {path.relative_to(ROOT)}')
    if (ROOT/'node_modules').is_dir():log('PASS','node_modules installed')
    else:log('WARN','Dependencies not installed in this workspace (npm ci required)')
    if (ROOT/'venv').is_dir():log('PASS','Python virtual environment exists (local Windows)')
    else:log('WARN','No local venv found (required on target server)')
    for name in ('python','node','npm'):
        log('PASS' if shutil.which(name) else 'FAIL',f'{name} executable')
    dburl=env_file_key('DATABASE_URL')
    if dburl.startswith('file:'):
        dbpath=(ROOT/dburl[len('file:'):].lstrip('/')).resolve() if not dburl.startswith('file:/') else Path(dburl[len('file:'):])
    else:
        dbpath=ROOT/'dev.db'
        log('WARN','DATABASE_URL is missing or nonstandard; assuming project-root dev.db')
    read_db(dbpath,'Prisma',{'User','Session','EmailVerificationToken','PasswordResetToken'})
    read_db(ROOT/'church_backend/instance/archive.db','Flask',{'document','certificate_request','mass_record','cemetery_slot','cemetery_reservation','cemetery_payment','burial_record'})
    for x in ['baptism_form.png','confirmation_form.png','marriage_front.png','marriage_back.png']:
        pass
    map_path=ROOT/'church_backend/uploads/cemetery/site_master_plan_reference.png'
    log('PASS' if map_path.is_file() else 'WARN','Cemetery map asset', 'copy to persistent storage on the host' if not map_path.is_file() else '')
    tesseract=env_file_key('TESSERACT_CMD') or env_file_key('TESSERACT_PATH')
    found=(Path(tesseract).is_file() if tesseract else False) or bool(shutil.which('tesseract'))
    if not found and os.name=='nt': found=Path(r'C:\Program Files\Tesseract-OCR\tesseract.exe').is_file()
    log('PASS' if found else 'WARN','Tesseract OCR executable', 'install/configure on target host if missing' if not found else '')
    base=env_file_key('APP_BASE_URL')
    log('PASS' if base.startswith('https://') and '.ngrok-' not in base else ('FAIL' if strict else 'WARN'), 'Permanent HTTPS APP_BASE_URL','ngrok is not permanent deployment' if not base or '.ngrok-' in base else '')
    for key in ('FLASK_API_URL','FLASK_INTERNAL_KEY','FLASK_SECRET_KEY','GOOGLE_CLIENT_ID','RESEND_API_KEY'):
        value=env_file_key(key)
        ok=bool(value) and value not in ('dev-only-change-me','changeme')
        if key in ('FLASK_SECRET_KEY','FLASK_INTERNAL_KEY'):ok=ok and len(value)>=32
        log('PASS' if ok else ('FAIL' if strict else 'WARN'),f'{key} configured')
    log('WARN','PayMongo remains test-mode; live payments are NOT enabled or approved')
    log('WARN','Cemetery inquiry/chat and SMS OTP are not implemented; do not claim production support')
    log('WARN','Full live browser, webhook, mail, role-access and upload persistence tests are still necessary')
    print(f'SUMMARY PASS={pass_count} WARN={warnings} FAIL={fail_count}')
    return 1 if fail_count else 0

if __name__=='__main__':sys.exit(main())
