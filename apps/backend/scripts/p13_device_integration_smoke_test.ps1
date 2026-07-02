param(
  [string]$ApiBaseUrl = $(if ($env:AGRIOS_API_URL) { $env:AGRIOS_API_URL } else { "http://localhost:3000/api/v1" }),
  [string]$FarmId = $(if ($env:AGRIOS_FARM_ID) { $env:AGRIOS_FARM_ID } else { "demo" }),
  [string]$DeviceId = $(if ($env:AGRIOS_DEVICE_ID) { $env:AGRIOS_DEVICE_ID } else { "replace_me_device_id" }),
  [string]$EdgeBaseUrl = $(if ($env:EDGE_CONTROLLER_BASE_URL) { $env:EDGE_CONTROLLER_BASE_URL } else { "http://localhost:18080" }),
  [string]$WebhookSecret = $(if ($env:THINGSBOARD_WEBHOOK_SECRET) { $env:THINGSBOARD_WEBHOOK_SECRET } else { "agrios_tb_secret" }),
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
  $uri = "$ApiBaseUrl$Path"
  if ($null -ne $Body) {
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body ($Body | ConvertTo-Json -Depth 20)
  }
  return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers
}

function Get-Data($Response) {
  if ($null -ne $Response.data) { return $Response.data }
  return $Response
}

Write-Host "AgriOS P13 device integration smoke test"
Write-Host "API: $ApiBaseUrl"
Write-Host "Farm: $FarmId"
Write-Host "Edge: $EdgeBaseUrl"
Write-Host ""

try {
  $health = Get-Data (Invoke-AgriOSJson "GET" "/health/ready")
  $mode = $health.deviceControlMode
  Add-Result "health ready" "PASS" "deviceControlMode=$mode ready=$($health.deviceControlModeReady)"
  if (-not $health.deviceControlModeReady) {
    Add-Result "device control mode" "WARN" "Check DEVICE_CONTROL_MODE and adapter env values."
  } else {
    Add-Result "device control mode" "PASS" "Mode is ready for configured adapter."
  }
} catch {
  Add-Result "health ready" "FAIL" $_.Exception.Message
}

try {
  $payload = @{
    deviceName = "demo-soil-sensor-a"
    deviceId = "tb-demo-soil-a"
    thingsboardDeviceId = "tb-demo-soil-a"
    ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    soilMoisture = 18
    temperature = 31
    humidity = 64
    battery = 91
    values = @{
      soilMoisture = 18
      temperature = 31
      humidity = 64
      pressureKpa = 180
      flowRateM3h = 12.3
      valveOpeningPercent = 60
      pumpFrequencyHz = 32
      fertilizerTankLevelL = 320
      batteryPercent = 91
      signalStrength = -60
    }
    metadata = @{ source = "p13-smoke-test"; farmId = $FarmId }
  }
  $headers = @{ "Content-Type" = "application/json"; "x-thingsboard-secret" = $WebhookSecret }
  $telemetry = Invoke-RestMethod -Method Post -Uri "$ApiBaseUrl/iot/thingsboard/telemetry" -Headers $headers -Body ($payload | ConvertTo-Json -Depth 20)
  Add-Result "mock ThingsBoard telemetry" "PASS" "Webhook accepted or processed: $($telemetry.success)"
} catch {
  Add-Result "mock ThingsBoard telemetry" "WARN" "Telemetry failed. Check THINGSBOARD_WEBHOOK_SECRET, DATABASE_URL, and device binding. $($_.Exception.Message)"
}

try {
  $summary = Get-Data (Invoke-AgriOSJson "GET" "/iot/farms/$FarmId/telemetry/summary")
  Add-Result "telemetry summary" "PASS" "Summary query returned."
} catch {
  Add-Result "telemetry summary" "WARN" "Could not verify DeviceTelemetrySnapshot/SensorRecord from summary. $($_.Exception.Message)"
}

try {
  Invoke-AgriOSJson "POST" "/ai-recommendations/analyze/farm/$FarmId" | Out-Null
  $recommendations = Get-Data (Invoke-AgriOSJson "GET" "/ai-recommendations?farmId=$FarmId")
  $count = if ($recommendations.items) { $recommendations.items.Count } elseif ($recommendations.Count) { $recommendations.Count } else { 0 }
  Add-Result "AI analyze farm" "PASS" "AIRecommendation count hint=$count"
} catch {
  Add-Result "AI analyze farm" "WARN" "This endpoint may require AGRIOS_TOKEN with AI permission. $($_.Exception.Message)"
}

try {
  $jobs = Get-Data (Invoke-AgriOSJson "GET" "/action-queue/jobs?farmId=$FarmId&pageSize=5")
  Add-Result "action queue list" "PASS" "ActionQueue query returned."
} catch {
  Add-Result "action queue list" "WARN" "Requires token/permission or no ActionQueue data yet. $($_.Exception.Message)"
}

try {
  $edgeHealth = Invoke-RestMethod -Method Get -Uri "$EdgeBaseUrl/health"
  Add-Result "edge simulator health" "PASS" $edgeHealth.message
  $edgeAck = Invoke-RestMethod -Method Post -Uri "$EdgeBaseUrl/commands/startPump" -Headers @{ "Content-Type" = "application/json" } -Body (@{
      deviceId = "demo-pump-001"
      requestId = "p13-smoke-$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"
      payload = @{ durationMinutes = 1 }
    } | ConvertTo-Json -Depth 10)
  Add-Result "edge mock command" "PASS" "$($edgeAck.message)"
} catch {
  Add-Result "edge mock command" "WARN" "Start simulator first: cd apps/backend; npm run sim:p13:edge. $($_.Exception.Message)"
}

try {
  if ($DeviceId -eq "replace_me_device_id") {
    Add-Result "AgriOS DeviceControl EDGE_HTTP" "WARN" "Set AGRIOS_DEVICE_ID to test /device-control/{id}/command through AgriOS."
  } else {
    $commandResult = Invoke-AgriOSJson "POST" "/device-control/$DeviceId/command" @{
      command = "PUMP_ON"
      adapter = "EDGE_HTTP"
      remark = "P13 smoke test through mock Edge controller only"
      payload = @{ durationMinutes = 1 }
    }
    Add-Result "AgriOS DeviceControl EDGE_HTTP" "PASS" "Command endpoint returned."
  }
} catch {
  Add-Result "AgriOS DeviceControl EDGE_HTTP" "WARN" "Requires token/permission and configured EDGE_CONTROLLER_BASE_URL. $($_.Exception.Message)"
}

foreach ($path in @(
  "/mobile/cockpit?farmId=$FarmId",
  "/mobile/map?farmId=$FarmId",
  "/ai-recommendations?farmId=$FarmId",
  "/mobile/reports/summary?farmId=$FarmId"
)) {
  try {
    Invoke-AgriOSJson "GET" $path | Out-Null
    Add-Result "mobile query $path" "PASS" "Queryable."
  } catch {
    Add-Result "mobile query $path" "WARN" $_.Exception.Message
  }
}

try {
  Invoke-AgriOSJson "GET" "/audit/events?farmId=$FarmId&pageSize=5" | Out-Null
  Add-Result "audit events" "PASS" "AuditEvent query returned."
} catch {
  Add-Result "audit events" "WARN" "Requires AGRIOS_TOKEN with audit permission. $($_.Exception.Message)"
}

Write-Host ""
$results | Format-Table -AutoSize

if ($results.Status -contains "FAIL") {
  exit 1
}

