param(
  [string]$BaseUrl = "http://localhost:3000/api/v1",
  [string]$FarmId = "demo"
)

$ErrorActionPreference = "Continue"
$results = @()

function Add-Result([string]$Name, [string]$Status, [string]$Message) {
  $script:results += [pscustomobject]@{ Name = $Name; Status = $Status; Message = $Message }
  Write-Host ("[{0}] {1} - {2}" -f $Status, $Name, $Message)
}

function Get-Json([string]$Name, [string]$Path) {
  try {
    $response = Invoke-RestMethod -Method GET -Uri "$BaseUrl$Path" -TimeoutSec 15
    Add-Result $Name "PASS" "HTTP OK"
    return $response
  } catch {
    Add-Result $Name "FAIL" $_.Exception.Message
    return $null
  }
}

function Has-Field($Object, [string]$Field) {
  return $null -ne $Object -and ($Object.PSObject.Properties.Name -contains $Field)
}

function Status-If([bool]$Condition, [string]$Ok = "PASS", [string]$Bad = "WARN") {
  if ($Condition) { return $Ok }
  return $Bad
}

Write-Host "AgriOS P11.7.2 demo acceptance test"
Write-Host "BaseUrl=$BaseUrl FarmId=$FarmId"

$health = Get-Json "demo health" "/demo/health?farmId=$FarmId"
if ($health) {
  if ($health.isReady) {
    Add-Result "demo readiness" "PASS" "Demo is ready"
  } elseif ($health.mobileCockpitReady) {
    Add-Result "demo readiness" "WARN" "Cockpit can load, but missing: $($health.missingItems -join ', ')"
  } else {
    Add-Result "demo readiness" "FAIL" "Missing: $($health.missingItems -join ', ')"
  }
}

$cockpit = Get-Json "mobile cockpit" "/mobile/cockpit?farmId=$FarmId"
if ($cockpit) {
  foreach ($field in @("farm", "deviceOnlineRate", "pressureSummary", "flowSummary", "fertigationStatus", "activeRotationRuns", "latestActivities")) {
    $hasField = Has-Field $cockpit $field
    Add-Result "cockpit field $field" (Status-If $hasField) ($(if ($hasField) { "present" } else { "missing" }))
  }
}

$map = Get-Json "mobile map" "/mobile/map?farmId=$FarmId"
if ($map) {
  Add-Result "map boundaries" (Status-If ($map.fieldBoundaries.Count -gt 0)) "$($map.fieldBoundaries.Count) boundaries"
  Add-Result "map drone layers" (Status-If (($map.droneRouteLayers.Count + $map.droneCoverageLayers.Count) -gt 0)) "route=$($map.droneRouteLayers.Count), coverage=$($map.droneCoverageLayers.Count)"
}

$operations = Get-Json "mobile operations" "/mobile/operations?farmId=$FarmId"
if ($operations) {
  Add-Result "operations rotation" (Status-If ($operations.rotationRuns.Count -gt 0)) "$($operations.rotationRuns.Count) rotation runs"
  Add-Result "operations fertigation" (Status-If ($operations.fertigationTasks.Count -gt 0)) "$($operations.fertigationTasks.Count) fertigation tasks"
}

$reports = Get-Json "mobile reports summary" "/mobile/reports/summary?farmId=$FarmId"
if ($reports) {
  foreach ($field in @("operationCostSummary", "pesticideUsageSummary", "droneServiceCostSummary", "cropHealthSummary", "yieldAnalysisSummary")) {
    $hasField = Has-Field $reports $field
    Add-Result "reports field $field" (Status-If $hasField) ($(if ($hasField) { "present" } else { "missing" }))
  }
}

$droneOperations = Get-Json "drone operations" "/drone-operations?farmId=$FarmId"
if ($droneOperations) {
  Add-Result "drone operations count" (Status-If ($droneOperations.Count -gt 0)) "$($droneOperations.Count) records"
}

$operationReports = Get-Json "operation reports" "/operation-reports?farmId=$FarmId"
if ($operationReports) {
  Add-Result "operation reports count" (Status-If ($operationReports.Count -gt 0)) "$($operationReports.Count) records"
}

$activities = Get-Json "farm activities" "/farm-activities?farmId=$FarmId"
if ($activities) {
  Add-Result "farm activities count" (Status-If ($activities.Count -gt 0)) "$($activities.Count) records"
}

$failCount = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
$warnCount = ($results | Where-Object { $_.Status -eq "WARN" }).Count

Write-Host "`nSummary:"
Write-Host "PASS=$(( $results | Where-Object { $_.Status -eq 'PASS' } ).Count) WARN=$warnCount FAIL=$failCount"
if ($failCount -gt 0) {
  Write-Host "Demo acceptance: FAIL"
  exit 1
}
if ($warnCount -gt 0) {
  Write-Host "Demo acceptance: WARN - demo can run but has gaps"
  exit 0
}
Write-Host "Demo acceptance: PASS - demo can be showcased"
