"""Run from backup-church using its existing project venv."""
from getpass import getpass
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import quote
import os
import re
import shutil
import subprocess
import sys

OLD_IMPORT = """import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'"""
OLD_INIT = """const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./dev.db' })
const prisma = new PrismaClient({ adapter })"""
NEW_IMPORT = """import 'dotenv/config'
import { prisma } from '../src/lib/prisma'"""


def seed_fix(source):
    if NEW_IMPORT in source and 'PrismaBetterSqlite3' not in source:
        return source
    if source.count(OLD_IMPORT) != 1 or source.count(OLD_INIT) != 1:
        raise SystemExit('Seed differs from the reviewed source. No files changed.')
    return source.replace(OLD_IMPORT, NEW_IMPORT).replace(OLD_INIT + '\n\n', '')


def pooler_uri(template, password):
    # Replace the password field before parsing, even when it contains brackets.
    match = re.fullmatch(r'postgres(?:ql)?(?:\+psycopg)?://(postgres\.[a-z0-9]+):[^\r\n]*@([a-z0-9.-]+\.pooler\.supabase\.com):5432/postgres(?:\?[^\s]*)?', template)
    if not match or not password:
        raise SystemExit('Expected the Shared Session pooler URI on port 5432 and a database password. No files changed.')
    return f'postgresql+psycopg://{match[1]}:{quote(password, safe="")}@{match[2]}:5432/postgres'


def save(path, data):
    with NamedTemporaryFile(dir=path.parent, delete=False) as out:
        tmp = Path(out.name)
        out.write(data)
    try:
        shutil.copymode(path, tmp)
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)


def updated_env(data, url):
    line = b'ARCHIVE_POSTGRES_URL="' + url.encode('ascii') + b'"'
    regex = rb'(?m)^[ \t]*(?:export[ \t]+)?ARCHIVE_POSTGRES_URL[ \t]*=[^\r\n]*'
    bom = b'\xef\xbb\xbf'
    prefix = bom if data.startswith(bom) else b''
    data = data[len(prefix):]
    if b'\x00' in data or len(re.findall(regex, data)) > 1:
        raise SystemExit('Unexpected .env encoding or duplicate URL entries. No files changed.')
    if re.search(regex, data):
        return prefix + re.sub(regex, lambda _: line, data)
    newline = b'\r\n' if b'\r\n' in data else b'\n'
    return prefix + data + (newline if data and not data.endswith(b'\n') else b'') + line + newline


def main():
    import psycopg
    root = Path.cwd()
    seed = root / 'prisma/seed.ts'
    env = root / '.env'
    if not all((root / p).is_file() for p in ('.env', 'prisma/seed.ts', 'src/lib/postgres-url.ts', 'scripts/cutover_postgres.py')):
        raise SystemExit('Open PowerShell in the patched backup-church project.')
    raw = seed.read_bytes()
    fixed = seed_fix(raw.decode('utf-8').replace('\r\n', '\n'))
    print('Paste the URI copied from Supabase > Connect > Session pooler, including its password placeholder.')
    template = getpass('Session pooler URI (hidden): ').strip()
    password = getpass('Actual database password (hidden; enter its original characters): ')
    url = pooler_uri(template, password)
    env_bytes = updated_env(env.read_bytes(), url)
    try:
        with psycopg.connect(url.replace('postgresql+psycopg:', 'postgresql:', 1), sslmode='require', connect_timeout=10) as con:
            result = con.execute("""SELECT to_regclass('parish_auth."User"') IS NOT NULL,
                                    to_regclass('parish_private.certificate_request') IS NOT NULL""").fetchone()
            if result != (True, True):
                raise SystemExit('Connected, but the imported Smart Parish tables are missing. Confirm the selected project. No files changed.')
    except psycopg.Error as exc:
        message = str(exc).lower()
        if 'password authentication failed' in message: hint = 'Password authentication failed. Check the database password.'
        elif 'tenant' in message: hint = 'Pooler could not identify the project. Copy its Session pooler URI again.'
        elif any(s in message for s in ('resolve', 'translate host', 'getaddrinfo')): hint = 'DNS could not resolve the pooler hostname.'
        elif 'timeout' in message: hint = 'Connection timed out. Check network access to the pooler.'
        elif 'ssl' in message or 'certificate' in message: hint = 'The TLS connection failed.'
        else: hint = 'The pooler connection or schema check failed.'
        raise SystemExit(f'{hint} SQLSTATE: {exc.sqlstate or "unavailable"}. No files changed.') from None
    fixed_bytes = fixed.replace('\n', '\r\n' if b'\r\n' in raw else '\n').encode('utf-8')
    if fixed_bytes != raw:
        save(seed, fixed_bytes)
    save(env, env_bytes)
    print('Pooler and both imported schemas verified. Updated .env and checked the seed code.', flush=True)
    child_env = dict(os.environ, ARCHIVE_POSTGRES_URL=url)
    prisma = root / 'node_modules/.bin' / ('prisma.cmd' if os.name == 'nt' else 'prisma')
    npm = shutil.which('npm.cmd' if os.name == 'nt' else 'npm')
    if not npm or not prisma.is_file():
        raise SystemExit('Missing project Prisma CLI or npm. The connection and seed repair are saved.')
    for command in ([str(prisma), 'generate'], [npm, 'run', 'build'], [sys.executable, 'scripts/cutover_postgres.py']):
        result = subprocess.run(command, env=child_env)
        if result.returncode:
            raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
