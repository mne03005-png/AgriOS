param(
  [string]$FarmId = "demo"
)

$ErrorActionPreference = "Stop"
$backendRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$repoRoot = Resolve-Path (Join-Path $backendRoot "../..")
$backendEnv = Join-Path $backendRoot ".env"
$rootEnv = Join-Path $repoRoot ".env"

function Get-DatabaseUrlFromFile([string]$path) {
  if (!(Test-Path $path)) { return $null }
  $line = Get-Content $path | Where-Object { $_ -match "^\s*DATABASE_URL\s*=" } | Select-Object -First 1
  if (!$line) { return $null }
  return ($line -replace "^\s*DATABASE_URL\s*=\s*", "").Trim().Trim('"')
}

$databaseUrl = $env:DATABASE_URL
if (!$databaseUrl) { $databaseUrl = Get-DatabaseUrlFromFile $backendEnv }
if (!$databaseUrl) { $databaseUrl = Get-DatabaseUrlFromFile $rootEnv }

if (!$databaseUrl) {
  Write-Host "DATABASE_URL was not found."
  Write-Host "Create apps/backend/.env and add an example like:"
  Write-Host 'DATABASE_URL="mysql://agrios:your_password@localhost:3306/agrios"'
  exit 1
}

Write-Host "DATABASE_URL found. Password is intentionally not printed."
Set-Location $backendRoot

Write-Host "`n1. Prisma validate"
npx.cmd prisma validate --schema prisma/schema.prisma

Write-Host "`n2. Prisma migrate status"
npx.cmd prisma migrate status --schema prisma/schema.prisma

Write-Host "`nIf migrations are pending, run:"
Write-Host "npx.cmd prisma migrate dev --schema prisma/schema.prisma"

Write-Host "`n3. Prisma db seed"
npx.cmd prisma db seed

Write-Host "`nStart backend in another terminal:"
Write-Host "npm.cmd run start:dev"

Write-Host "`nVerification commands:"
Write-Host "curl.exe http://localhost:3000/api/v1/demo/health?farmId=$FarmId"
Write-Host "curl.exe http://localhost:3000/api/v1/mobile/cockpit?farmId=$FarmId"
Write-Host "curl.exe http://localhost:3000/api/v1/mobile/map?farmId=$FarmId"
Write-Host "curl.exe http://localhost:3000/api/v1/mobile/reports/summary?farmId=$FarmId"
Write-Host "curl.exe http://localhost:3000/api/v1/farm-activities?farmId=$FarmId"
Write-Host "curl.exe http://localhost:3000/api/v1/drone-operations?farmId=$FarmId"
Write-Host "curl.exe http://localhost:3000/api/v1/operation-reports?farmId=$FarmId"
