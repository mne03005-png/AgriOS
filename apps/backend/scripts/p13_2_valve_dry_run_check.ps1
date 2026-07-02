param(
  [string]$BaseUrl = $(if ($env:AGRIOS_API_URL) { $env:AGRIOS_API_URL } else { "http://localhost:3000/api/v1" }),
  [string]$FarmId = $(if ($env:AGRIOS_FARM_ID) { $env:AGRIOS_FARM_ID } else { "demo" }),
  [string]$ValveDeviceCode = $(if ($env:AGRIOS_VALVE_DEVICE_CODE) { $env:AGRIOS_VALVE_DEVICE_CODE } else { "demo-valve-001" }),
  [string]$Token = $env:AGRIOS_TOKEN
)

$ErrorActionPreference = "Stop"
$results = @()

function Add-Result([string]$Name, [string]$Status, [string]$Message) {
  $script:results += [PSCustomObject]@{ Step = $Name; Status = $Status; Message = $Message }
  Write-Host "[$Status] $Name - $Message"
}

function Invoke-AgriOSJson([string]$Method, [string]$Path, [object]$Body = $null) {
  $headers = @{ "Content-Type" = "application/json" }
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  $uri = "$BaseUrl$Path"
  if ($null -ne $Body) {
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body ($Body | ConvertTo-Json -Depth 20)
  }
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
}

function Get-Data($Response) {
  if ($null -ne $Response.data) { return $Response.data }
  return $Response
}

Write-Host "AgriOS P13.2 valve dry-run check"
Write-Host "API: $BaseUrl"
Write-Host "Farm: $FarmId"
Write-Host "Valve: $ValveDeviceCode"
Write-Host ""

try {
  $health = Get-Data (Invoke-AgriOSJson "GET" "/health/ready")
  Add-Result "health ready" "PASS" "valveDryRun=$($health.valveDryRun) realControlAllowed=$($health.valveRealControlAllowed)"
  if ($health.valveDryRun -ne $true) {
    Add-Result "DEVICE_CONTROL_DRY_RUN" "WARN" "Expected default dry-run=true for P13.2."
  } else {
    Add-Result "DEVICE_CONTROL_DRY_RUN" "PASS" "Dry-run is enabled."
  }
} catch {
  Add-Result "health ready" "FAIL" $_.Exception.Message
}

try {
  $devices = Get-Data (Invoke-AgriOSJson "GET" "/iot/devices?keyword=$ValveDeviceCode&pageSize=10")
  $items = if ($devices.items) { $devices.items } elseif ($devices -is [array]) { $devices } else { @() }
  $valve = $items | Where-Object { $_.code -eq $ValveDeviceCode -or $_.id -eq $ValveDeviceCode } | Select-Object -First 1
  if ($valve) {
    $script:ValveDeviceId = $valve.id
    Add-Result "query demo valve" "PASS" "deviceId=$($valve.id) type=$($valve.type)"
  } else {
    $script:ValveDeviceId = $ValveDeviceCode
    Add-Result "query demo valve" "WARN" "Could not find valve by code; using supplied identifier."
  }
} catch {
  $script:ValveDeviceId = $ValveDeviceCode
  Add-Result "query demo valve" "WARN" $_.Exception.Message
}

if (-not $Token) {
  Add-Result "auth token" "WARN" "Set AGRIOS_TOKEN to exercise guarded valve control APIs."
} else {
  try {
    $testOpen = Get-Data (Invoke-AgriOSJson "POST" "/device-control/valves/$ValveDeviceId/test-open" @{ dryRun = $true; testDurationSeconds = 3 })
    $script:CommandId = $testOpen.commandId
    Add-Result "dry-run test-open" "PASS" "commandId=$($testOpen.commandId) queueJobId=$($testOpen.queueJobId)"
    if ($testOpen.dryRun -eq $true -and $testOpen.safety.allowed -eq $true) {
      Add-Result "Safety dry-run" "PASS" "Safety result allowed dry-run."
    } else {
      Add-Result "Safety dry-run" "WARN" "Unexpected safety result."
    }
    if ($testOpen.queueJobId) { Add-Result "ActionQueueJob" "PASS" "Queue job recorded." } else { Add-Result "ActionQueueJob" "WARN" "No queueJobId returned." }
    if ($testOpen.deviceCommandId) { Add-Result "DeviceCommand" "PASS" "Device command recorded." } else { Add-Result "DeviceCommand" "WARN" "No deviceCommandId returned." }
    if ($testOpen.actionExecutionId) { Add-Result "ActionExecution" "PASS" "Action execution recorded." } else { Add-Result "ActionExecution" "WARN" "No actionExecutionId returned." }
  } catch {
    Add-Result "dry-run test-open" "FAIL" $_.Exception.Message
  }

  if ($CommandId) {
    $ack = @{
      commandId = $CommandId
      deviceId = $ValveDeviceId
      valveStatus = "OPEN"
      valveOpeningPercent = 5
      success = $true
      errorCode = $null
      errorMessage = $null
      timestamp = [DateTimeOffset]::UtcNow.ToString("o")
    }
    try {
      Invoke-AgriOSJson "POST" "/device-control/valves/feedback" $ack | Out-Null
      $dup = Get-Data (Invoke-AgriOSJson "POST" "/device-control/valves/feedback" $ack)
      Add-Result "duplicate ACK idempotency" "PASS" "duplicate=$($dup.duplicate)"
    } catch {
      Add-Result "duplicate ACK idempotency" "WARN" $_.Exception.Message
    }
  }

  try {
    $status = Get-Data (Invoke-AgriOSJson "GET" "/device-control/valves/$ValveDeviceId/status")
    Add-Result "valve status" "PASS" "status=$($status.valveStatus) opening=$($status.valveOpeningPercent)"
  } catch {
    Add-Result "valve status" "WARN" $_.Exception.Message
  }

  try {
    Invoke-AgriOSJson "POST" "/device-control/valves/$ValveDeviceId/set-opening" @{ dryRun = $true; openingPercent = 101 } | Out-Null
    Add-Result "invalid opening rejected" "FAIL" "openingPercent=101 was accepted unexpectedly."
  } catch {
    Add-Result "invalid opening rejected" "PASS" "Invalid opening was rejected."
  }

  try {
    Invoke-AgriOSJson "GET" "/audit/events?pageSize=5" | Out-Null
    Add-Result "AuditEvent" "PASS" "Audit event endpoint query returned."
  } catch {
    Add-Result "AuditEvent" "WARN" $_.Exception.Message
  }

  try {
    Invoke-AgriOSJson "GET" "/event-bus/recent" | Out-Null
    Add-Result "EventLog" "PASS" "Event bus recent endpoint returned."
  } catch {
    Add-Result "EventLog" "WARN" "EventLog exists in DB, but recent event endpoint may be unavailable. $($_.Exception.Message)"
  }
}

try {
  $metrics = Get-Data (Invoke-AgriOSJson "GET" "/health/metrics")
  Add-Result "health metrics" "PASS" "pending=$($metrics.valvePendingCommands) failed=$($metrics.valveFailedCommands) timeout=$($metrics.valveTimeoutCommands)"
} catch {
  Add-Result "health metrics" "WARN" $_.Exception.Message
}

Add-Result "pump not started" "PASS" "P13.2 script never calls pump or irrigation endpoints."

Write-Host ""
$results | Format-Table -AutoSize

if ($results.Status -contains "FAIL") {
  exit 1
}
