# Smart Parish: narrowly allow the explicitly configured HTTPS test origin in development.
# Does NOT disable CSRF protection or modify .env, databases, passwords, or payments.
$ErrorActionPreference = 'Stop'
$project = (Get-Location).Path
$proxyPath = Join-Path $project 'src\proxy.ts'
if (-not (Test-Path -LiteralPath (Join-Path $project 'package.json')) -or
    -not (Test-Path -LiteralPath $proxyPath)) {
  throw 'Run this from the backup-church project root (package.json and src/proxy.ts required).'
}
$source = [System.IO.File]::ReadAllText($proxyPath)
$before = '(origin && expected && origin !== expected) ||'
$after = "(origin && expected && origin !== expected && !(process.env.NODE_ENV !== 'production' && configured?.startsWith('https://') && origin === configured)) ||"
if ($source.Contains($after)) {
  Write-Host 'ALREADY FIXED: ngrok origin comparison is present.' -ForegroundColor Green
  exit 0
}
if (-not $source.Contains($before)) {
  throw 'STOP: src/proxy.ts does not match the inspected version. Do not overwrite or force this patch.'
}
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backup = Join-Path $env:TEMP "smartparish_proxy_before_ngrok_$timestamp.ts"
Copy-Item -LiteralPath $proxyPath -Destination $backup -ErrorAction Stop
$updated = $source.Replace($before, $after)
if ($updated -eq $source -or -not $updated.Contains($after)) {
  throw 'Patch did not match the target condition; original file preserved.'
}
[System.IO.File]::WriteAllText($proxyPath, $updated, [System.Text.UTF8Encoding]::new($false))
Write-Host 'PASS: updated src/proxy.ts to allow only APP_BASE_URL as an additional HTTPS development origin.' -ForegroundColor Green
Write-Host "Backup saved outside project: $backup"
Write-Host 'NEXT: In project .env, set APP_BASE_URL to the exact HTTPS ngrok forwarding URL; restart Next.js.'
