param(
  [string]$BaseUrl = $(if ($env:AGRIOS_API_URL) { $env:AGRIOS_API_URL } else { "http://localhost:3000/api/v1" }),
  [string]$FarmId = $(if ($env:AGRIOS_FARM_ID) { $env:AGRIOS_FARM_ID } else { "demo" }),
  [string]$DeviceName = $(if ($env:AGRIOS_DEVICE_NAME) { $env:AGRIOS_DEVICE_NAME } else { "FARM-demo-FIELD-A-SOIL-001" }),
  [string]$ThingsboardDeviceId = $(if ($env:THINGSBOARD_DEVICE_ID) { $env:THINGSBOARD_DEVICE_ID } else { "tb-demo-soil-a" }),
  [string]$WebhookSecret = $(if ($env:THINGSBOARD_WEBHOOK_SECRET) { $env:THINGSBOARD_WEBHOOK_SECRET } else { "agrios_tb_secret" }),
  [string]$Token = $env:AGRIOS_TOKEN
)

$ErrorActionPreference = "Stop"
$results = @()

function Add-Result([string]$Name, [string]$Status, [string]$Message) {
  $script:results += [PSCustomObject]@{ Step = $Name; Status = $Status; Message = $Message }
  Write-Host "[$Status] $Name - $Message"
}

function Invoke-AgriOSJson([string]$Method, [string]$Path, [object]$Body = $null, [hashtable]$ExtraHeaders = @{}) {
  $headers = @{ "Content-Type" = "application/json" }
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  foreach ($key in $ExtraHeaders.Keys) { $headers[$key] = $ExtraHeaders[$key] }
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

Write-Host "AgriOS P13.1 real sensor telemetry check"
Write-Host "API: $BaseUrl"
Write-Host "Farm: $FarmId"
Write-Host "DeviceName: $DeviceName"
Write-Host "ThingsboardDeviceId: $ThingsboardDeviceId"
Write-Host ""

try {
  $health = Get-Data (Invoke-AgriOSJson "GET" "/health/ready")
  Add-Result "backend health" "PASS" "ready endpoint returned; deviceControlMode=$($health.deviceControlMode)"
} catch {
  Add-Result "backend health" "FAIL" $_.Exception.Message
}

try {
  $payload = @{
    deviceName = $DeviceName
    deviceId = $ThingsboardDeviceId
    thingsboardDeviceId = $ThingsboardDeviceId
    telemetry = @{
      soilMoisture = 31.2
      soilTemperature = 22.5
      batteryPercent = 88
      signalStrength = -70
    }
    values = @{
      pressureKpa = 145.5
      flowRateM3h = 4.2
    }
    ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  }
  $telemetry = Get-Data (Invoke-AgriOSJson "POST" "/iot/thingsboard/telemetry" $payload @{ "x-thingsboard-secret" = $WebhookSecret })
  if ($telemetry.accepted -eq $false) {
    Add-Result "send sensor payload" "WARN" "Webhook returned accepted=false; deadLetterId=$($telemetry.deadLetterId)"
  } else {
    Add-Result "send sensor payload" "PASS" "saved=$($telemetry.saved) duplicated=$($telemetry.duplicated) sensorRecordId=$($telemetry.sensorRecordId)"
  }
} catch {
  Add-Result "send sensor payload" "FAIL" "Check THINGSBOARD_WEBHOOK_SECRET and DATABASE_URL. $($_.Exception.Message)"
}

try {
  $records = Get-Data (Invoke-AgriOSJson "GET" "/sensor-records?pageSize=5")
  $items = if ($records.items) { $records.items } elseif ($records -is [array]) { $records } else { @() }
  $match = $items | Where-Object { $_.thingsboardDeviceId -eq $ThingsboardDeviceId -or $_.deviceName -eq $DeviceName } | Select-Object -First 1
  if ($match) {
    Add-Result "query SensorRecord" "PASS" "latest matching record id=$($match.id)"
  } else {
    Add-Result "query SensorRecord" "WARN" "SensorRecord endpoint returned, but no matching recent record was found."
  }
} catch {
  Add-Result "query SensorRecord" "WARN" $_.Exception.Message
}

try {
  $latest = Get-Data (Invoke-AgriOSJson "GET" "/iot/farms/$FarmId/telemetry/latest-real-sensor")
  if ($latest.sensorRecord -or $latest.snapshot) {
    Add-Result "query DeviceTelemetrySnapshot" "PASS" "latest real sensor endpoint returned telemetry."
  } else {
    Add-Result "query DeviceTelemetrySnapshot" "WARN" "No snapshot yet. Link an AgriOS device to update DeviceTelemetrySnapshot."
  }
} catch {
  Add-Result "query DeviceTelemetrySnapshot" "WARN" $_.Exception.Message
}

foreach ($path in @(
  "/mobile/cockpit?farmId=$FarmId",
  "/mobile/map?farmId=$FarmId",
  "/ai-recommendations/latest?farmId=$FarmId"
)) {
  try {
    Invoke-AgriOSJson "GET" $path | Out-Null
    Add-Result "query $path" "PASS" "Queryable."
  } catch {
    Add-Result "query $path" "WARN" $_.Exception.Message
  }
}

try {
  $candidates = Get-Data (Invoke-AgriOSJson "GET" "/iot/devices/binding-candidates?thingsboardDeviceId=$ThingsboardDeviceId&deviceName=$DeviceName")
  $count = if ($candidates.candidates) { $candidates.candidates.Count } else { 0 }
  Add-Result "binding candidates" "PASS" "candidate count=$count"
} catch {
  Add-Result "binding candidates" "WARN" $_.Exception.Message
}

Write-Host ""
$results | Format-Table -AutoSize

if ($results.Status -contains "FAIL") {
  exit 1
}
