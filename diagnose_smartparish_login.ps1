# Smart Parish read-only staff login diagnostic, November 2026.
# Run from the backup-church project root.
# Does not modify accounts or database files; prompts privately for the password.
$ErrorActionPreference = 'Stop'
$project = (Get-Location).Path
if (-not (Test-Path (Join-Path $project 'package.json')) -or -not (Test-Path (Join-Path $project 'prisma\schema.prisma'))) {
    throw 'Please open PowerShell in the backup-church project root.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js was not found on PATH.' }

Write-Host 'SMART PARISH LOGIN DIAGNOSTIC (READ-ONLY)' -ForegroundColor Cyan
Write-Host 'This tool will not display your email, password, or password hash.'
$email = (Read-Host 'Existing Main Admin or Burial Admin login email').Trim().ToLowerInvariant()
if ($email -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw 'Invalid email format.' }
$privatePassword = Read-Host 'Enter the exact password that failed in the browser (hidden)' -AsSecureString
$plainPtr = [IntPtr]::Zero
$nodeScript = Join-Path $project 'scripts\_temporary_staff_login_probe.cjs'
if (Test-Path -LiteralPath $nodeScript) {
    throw 'Temporary diagnostic filename already exists. No files changed; please contact support.'
}

$javascript = @'
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const Sqlite = require('better-sqlite3');
const {loadEnvConfig} = require('@next/env');

const email = (process.env.SMARTPARISH_DIAG_EMAIL || '').trim().toLowerCase();
const password = process.env.SMARTPARISH_DIAG_PASSWORD || '';
const cliUrl = process.env.DATABASE_URL || 'file:./dev.db';
loadEnvConfig(process.cwd(), true);
const webUrl = process.env.DATABASE_URL || 'file:./dev.db';

function resolveDbPath(url) {
  if (!url.startsWith('file:')) throw new Error('Only SQLite file: DATABASE_URL is supported by this diagnostic.');
  let file = url.slice(5).split('?')[0];
  if (file.startsWith('///')) file = file.slice(2);
  file = decodeURIComponent(file);
  if (process.platform === 'win32' && /^\/[a-zA-Z]:[\\/]/.test(file)) file = file.slice(1);
  return path.resolve(process.cwd(), file);
}

function inspect(label, filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(label + ': DATABASE FILE NOT FOUND');
    return {exists:false, found:false, matches:false};
  }
  const db = new Sqlite(filePath, {readonly:true, fileMustExist:true});
  try {
    const row = db.prepare('SELECT role, password FROM User WHERE email = ? LIMIT 1').get(email);
    if (!row) {
      console.log(label + ': staff email not present in this database');
      return {exists:true, found:false, matches:false};
    }
    const ok = bcrypt.compareSync(password, row.password);
    console.log(label + ': account exists; role=' + row.role + '; password matches=' + (ok?'YES':'NO'));
    return {exists:true, found:true, matches:ok};
  } finally {
    db.close();
  }
}

const cliPath = resolveDbPath(cliUrl);
const webPath = resolveDbPath(webUrl);
console.log('CLI and Next.js database paths match: ' + (cliPath.toLowerCase() === webPath.toLowerCase() ? 'YES' : 'NO'));
const cli = inspect('CLI', cliPath);
const web = cliPath.toLowerCase() === webPath.toLowerCase() ? cli : inspect('NEXT.JS', webPath);
if (cliPath.toLowerCase() === webPath.toLowerCase()) console.log('NEXT.JS: same account and password result as CLI');
if (!web.found) console.log('DIAGNOSIS: Next.js does not appear to have the expected account. Check DATABASE_URL configuration.');
else if (!web.matches && cli.matches) console.log('DIAGNOSIS: CLI and Next.js read different passwords/databases. Check DATABASE_URL configuration.');
else if (!web.matches) console.log('DIAGNOSIS: This exact password does not match the hash in the Next.js database. Re-entry or rotation is needed.');
else console.log('DIAGNOSIS: The password matches the Next.js database. If the browser still gets 401, investigate the running Next.js process and submitted request.');
'@;

try {
    $plainPtr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($privatePassword)
    $env:SMARTPARISH_DIAG_EMAIL = $email
    $env:SMARTPARISH_DIAG_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($plainPtr)
    [System.IO.File]::WriteAllText($nodeScript, $javascript, [System.Text.UTF8Encoding]::new($false))
    & node $nodeScript
    if ($LASTEXITCODE -ne 0) { throw 'Diagnostic failed. No accounts were modified.' }
} finally {
    Remove-Item Env:SMARTPARISH_DIAG_EMAIL, Env:SMARTPARISH_DIAG_PASSWORD -ErrorAction SilentlyContinue
    if ($plainPtr -ne [IntPtr]::Zero) { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($plainPtr) }
    if ($null -ne $privatePassword) { $privatePassword.Dispose() }
    if (Test-Path -LiteralPath $nodeScript) { Remove-Item -LiteralPath $nodeScript -Force }
}
Write-Host 'Diagnostic finished. Password not printed or saved.' -ForegroundColor Green
