# READ ONLY toward the populated SQLite database; writes SQL preview OUTSIDE the repo.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
if (-not (Test-Path '.\dev.db')) { throw 'Missing dev.db. Do not create a new database.' }
$destination = Join-Path (Split-Path $root -Parent) 'prisma_baseline_review.sql'
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
if ($LASTEXITCODE -ne 0) { throw 'Current schema diff failed.' }
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output $destination
if ($LASTEXITCODE -ne 0) { throw 'Baseline generation failed.' }
Write-Host "SQL baseline preview: $destination"
Write-Host 'NO migrations were applied. Back up existing migration history and review before marking any migration as applied.'
