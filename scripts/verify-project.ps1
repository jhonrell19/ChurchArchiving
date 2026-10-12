$ErrorActionPreference = "Stop"

function Assert-LastExitCode {
  param([string]$Step)
  if ($LASTEXITCODE -ne 0) {
    throw "$Step failed with exit code $LASTEXITCODE."
  }
}

Write-Host "== Smart Parish verification ==" -ForegroundColor Cyan

if (-not (Test-Path ".\package.json")) {
  throw "Run this script from the project root."
}

Write-Host "[1/5] Python syntax" -ForegroundColor Yellow
python -m py_compile church_backend\server.py church_backend\models.py church_backend\migrate_panel_phase1.py church_backend\wsgi.py
Assert-LastExitCode "Python syntax check"

Write-Host "[2/5] Source audit" -ForegroundColor Yellow
$matches = Get-ChildItem .\src -Recurse -File | Select-String -Pattern "mockData|MOCK_|http://127\.0\.0\.1:5000"
if ($matches) {
  $matches | Format-Table Path, LineNumber, Line -AutoSize
  throw "Old frontend mock/direct-Flask references were found."
}

Write-Host "[3/5] Prisma client" -ForegroundColor Yellow
npx prisma generate
Assert-LastExitCode "Prisma generation"

Write-Host "[4/5] ESLint" -ForegroundColor Yellow
npm run lint
Assert-LastExitCode "ESLint"

Write-Host "[5/5] Production build" -ForegroundColor Yellow
npm run build
Assert-LastExitCode "Production build"

Write-Host "All automated checks passed. Run TESTING_GUIDE.md next." -ForegroundColor Green
