# Secure interactive wrapper: no password literals in command history, .env or scripts.
# Run in Windows PowerShell from any directory after installing this file.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not (Test-Path (Join-Path $root 'prisma\schema.prisma'))) { throw 'Project root not found' }

$original = (Get-Location).Path
$mainSecure = $null
$burialSecure = $null
try {
    Set-Location $root
    Write-Host 'Rotating EXISTING Main Admin and Burial Admin credentials (no new accounts will be created).'
    $env:MAIN_ADMIN_EMAIL = (Read-Host 'Current Main Admin login email').Trim()
    $env:BURIAL_ADMIN_EMAIL = (Read-Host 'Current Burial Admin login email').Trim()
    $mainSecure = Read-Host 'New unique Main Admin password (16+ characters, hidden)' -AsSecureString
    $burialSecure = Read-Host 'New unique Burial Admin password (16+ characters, hidden)' -AsSecureString

    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($mainSecure)
    try { $env:MAIN_ADMIN_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($burialSecure)
    try { $env:BURIAL_ADMIN_PASSWORD = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
    finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }

    $env:STAFF_PASSWORD_ROTATION = 'YES'
    & npx tsx scripts/rotate_staff_passwords.ts
    if ($LASTEXITCODE -ne 0) { throw 'Staff rotation failed. No success claimed; examine STOP message.' }
    & npx tsx scripts/audit_staff_passwords.ts
    if ($LASTEXITCODE -ne 0) { throw 'Password audit failed. Do not expose the service publicly.' }
    Write-Host 'Finished: staff password audit passed. Re-login to each account to verify.' -ForegroundColor Green
}
finally {
    Remove-Item Env:MAIN_ADMIN_PASSWORD, Env:BURIAL_ADMIN_PASSWORD, Env:MAIN_ADMIN_EMAIL, Env:BURIAL_ADMIN_EMAIL, Env:STAFF_PASSWORD_ROTATION -ErrorAction SilentlyContinue
    if ($null -ne $mainSecure) { $mainSecure.Dispose() }
    if ($null -ne $burialSecure) { $burialSecure.Dispose() }
    Set-Location $original
}
