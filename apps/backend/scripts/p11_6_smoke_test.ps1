param(
  [string]$BaseUrl = "http://localhost:3000/api/v1",
  [string]$FarmId = "farm_001",
  [string]$FieldId = "field_001",
  [string]$OperationId = "replace_me"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../../..")
$sampleFile = Join-Path $repoRoot "samples/drone/onion-field-a.kml"

Write-Host "P11.6 smoke test: import drone file"
curl.exe -X POST "$BaseUrl/drone-operations/import-file" `
  -F "farmId=$FarmId" `
  -F "fieldId=$FieldId" `
  -F "source=DJI_SMARTFARM" `
  -F "operationType=SPRAYING" `
  -F "droneModel=DJI Agras T50" `
  -F "chemicalName=onion foliar fertilizer" `
  -F "sprayVolumeL=92" `
  -F "file=@$sampleFile"

Write-Host "`nP11.6 smoke test: list drone operations"
curl.exe "$BaseUrl/drone-operations?farmId=$FarmId"

Write-Host "`nP11.6 smoke test: list reviews"
curl.exe "$BaseUrl/drone-operations/reviews?farmId=$FarmId"

if ($OperationId -eq "replace_me") {
  Write-Host "`nReplace -OperationId with the imported DroneOperation id, then rerun review/report steps."
  exit 0
}

Write-Host "`nP11.6 smoke test: link field"
curl.exe -X POST "$BaseUrl/drone-operations/$OperationId/review/link-field" `
  -H "Content-Type: application/json" `
  -d "{`"fieldId`":`"$FieldId`",`"reviewNote`":`"smoke link`"}"

Write-Host "`nP11.6 smoke test: approve review"
curl.exe -X POST "$BaseUrl/drone-operations/$OperationId/review/approve" `
  -H "Content-Type: application/json" `
  -d "{`"reviewNote`":`"smoke approved`"}"

Write-Host "`nP11.6 smoke test: generate report"
curl.exe -X POST "$BaseUrl/drone-operations/$OperationId/generate-report"

Write-Host "`nP11.6 smoke test: operation costs"
curl.exe "$BaseUrl/operation-costs?farmId=$FarmId"

Write-Host "`nP11.6 smoke test: crop health observations"
curl.exe "$BaseUrl/crop-health/observations?farmId=$FarmId"

Write-Host "`nP11.6 smoke test: yield factors"
curl.exe "$BaseUrl/yield-analysis/factors?farmId=$FarmId"

Write-Host "`nP11.6 smoke test: mobile reports summary"
curl.exe "$BaseUrl/mobile/reports/summary?farmId=$FarmId"
