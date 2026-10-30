"""Smart Parish test-data reset. Run from project root with --preview or --execute.
Backs up both SQLite databases and upload directories BEFORE destructive changes.
Preserves exactly one ADMIN and one BURIAL_ADMIN account, not their sessions.
"""
from __future__ import annotations
import argparse
from datetime import datetime
from pathlib import Path
import shutil
import sqlite3
import sys

ROOT = Path(__file__).resolve().parent
FLASK_DB = ROOT / 'church_backend' / 'instance' / 'archive.db'
AUTH_CANDIDATES = [ROOT / 'dev.db', ROOT / 'prisma' / 'dev.db']
UPLOAD_DIRS = [ROOT / 'church_backend' / 'uploads', ROOT / 'uploads']
EXPECTED_CHURCH = {'document', 'audit_log', 'certificate_request', 'mass_record', 'announcement', 'cemetery_slot', 'cemetery_reservation', 'cemetery_payment', 'burial_record'}
EXPECTED_AUTH = {'User', 'Session', 'EmailVerificationToken', 'PasswordResetToken', '_prisma_migrations'}

def connect(path):
    conn=sqlite3.connect(str(path), timeout=10)
    conn.row_factory=sqlite3.Row
    return conn

def tables(conn):
    return {r['name'] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}

def quote(name):
    return '"' + name.replace('"', '""') + '"'

def counts(conn, names):
    return {t:conn.execute('SELECT COUNT(*) FROM '+quote(t)).fetchone()[0] for t in sorted(names)}

def backup_database(src,dst):
    source=connect(src)
    target=connect(dst)
    try:
        source.backup(target)
    finally:
        target.close(); source.close()

def main():
    p=argparse.ArgumentParser()
    group=p.add_mutually_exclusive_group(required=True)
    group.add_argument('--preview', action='store_true')
    group.add_argument('--execute', action='store_true')
    args=p.parse_args()
    if not FLASK_DB.is_file(): sys.exit('STOP: church_backend/instance/archive.db not found.')
    possible=[x for x in AUTH_CANDIDATES if x.is_file()]
    if len(possible)!=1:
        sys.exit('STOP: Expected exactly one Prisma SQLite database at dev.db or prisma/dev.db. Found '+str(possible)+'. Nothing changed.')
    auth_db=possible[0]
    c=connect(auth_db)
    a=connect(FLASK_DB)
    try:
        at=tables(c); ft=tables(a)
        if not {'User','Session','EmailVerificationToken','PasswordResetToken'}.issubset(at):
            sys.exit('STOP: Prisma account tables missing. No changes made.')
        if not EXPECTED_CHURCH.issubset(ft):
            sys.exit('STOP: Expected church tables missing: '+str(EXPECTED_CHURCH-ft))
        extra_auth=at-EXPECTED_AUTH
        extra_church=ft-EXPECTED_CHURCH
        if extra_auth or extra_church:
            sys.exit('STOP: Unknown tables. Auth: '+str(extra_auth)+' / Church: '+str(extra_church)+'. Requires review before deletion.')
        admin_users=c.execute('SELECT id, email, role FROM "User" WHERE role IN (\'ADMIN\',\'BURIAL_ADMIN\') ORDER BY role').fetchall()
        roles=[r['role'] for r in admin_users]
        if sorted(roles)!=['ADMIN','BURIAL_ADMIN']:
            sys.exit('STOP: Need EXACTLY one ADMIN and one BURIAL_ADMIN before reset. Found: '+str(roles)+'. Nothing changed.')
        print('\nADMIN ACCOUNTS TO KEEP:')
        for user in admin_users: print(' ',user['role'],user['email'],'(id='+str(user['id'])+')')
        print('\nAUTH COUNTS:', counts(c, at-{'_prisma_migrations'}))
        print('CHURCH COUNTS:', counts(a, ft))
        print('UPLOAD DIRECTORIES:',*[str(x) for x in UPLOAD_DIRS if x.exists()], sep='\n  ')
    finally:
        c.close();a.close()
    print('\nWILL DELETE: all non-admin users, all sessions/reset/verification tokens, all church records (including cemetery slots, payment histories, announcements, masses and archives), and uploaded files.')
    print('WILL KEEP: the two admin account rows, database schemas, program source, templates outside uploads, and configuration.')
    if args.preview: print('\nPREVIEW ONLY. No data changed.');return
    confirm=input('\nType exactly RESET TEST DATA to make a backup and erase this data: ')
    if confirm!='RESET TEST DATA': sys.exit('Canceled. No changes.')
    destination=ROOT.parent / ('smart_parish_backup_before_reset_'+datetime.now().strftime('%Y%m%d_%H%M%S'))
    destination.mkdir(parents=True, exist_ok=False)
    print('Backing up to:',destination)
    backup_database(FLASK_DB,destination/'archive.db')
    backup_database(auth_db,destination/'auth_dev.db')
    for folder in UPLOAD_DIRS:
        if folder.exists():
            shutil.copytree(folder,destination/('uploads_church' if folder==UPLOAD_DIRS[0] else 'uploads_root'))
    print('Backup completed. Deleting database test records...')
    c=connect(auth_db)
    a=connect(FLASK_DB)
    try:
        # No active user sessions survive the reset, including staff sessions.
        c.execute('BEGIN IMMEDIATE')
        for t in ('Session','EmailVerificationToken','PasswordResetToken'):
            c.execute('DELETE FROM '+quote(t))
        c.execute('DELETE FROM "User" WHERE role NOT IN (\'ADMIN\',\'BURIAL_ADMIN\')')
        c.commit()
        a.execute('PRAGMA foreign_keys=OFF')
        a.execute('BEGIN IMMEDIATE')
        for t in sorted(EXPECTED_CHURCH): a.execute('DELETE FROM '+quote(t))
        if 'sqlite_sequence' in {r['name'] for r in a.execute("SELECT name FROM sqlite_master WHERE type='table'")}:
            a.execute('DELETE FROM sqlite_sequence WHERE name IN ('+','.join('?' for _ in EXPECTED_CHURCH)+')',tuple(EXPECTED_CHURCH))
        a.commit()
    except Exception:
        c.rollback();a.rollback()
        print('ERROR. Backup exists at:',destination)
        raise
    finally:
        c.close(); a.close()
    print('Databases cleared. Removing uploaded files...')
    for folder in UPLOAD_DIRS:
        if not folder.exists(): continue
        for path in folder.iterdir():
            if path.name=='.gitkeep': continue
            if path.is_dir(): shutil.rmtree(path)
            elif path.is_file(): path.unlink()
    print('\nRESET COMPLETE. Backup:',destination)
    print('Both staff users remain; all users are logged out. Restart Flask and Next.js and log in again.')
    print('NOTE: Any payments registered with PayMongo remain on PayMongo; this resets only the local app data.')

if __name__=='__main__': main()
