# AgriOS P13.1 Real Sensor Telemetry Integration

## Goal

P13.1 connects the first low-risk real sensor telemetry path. This phase validates only telemetry ingestion and observation. It does not control pumps, valves, DJI devices, or any other real hardware.

Recommended first devices:

- Soil moisture sensor
- Pressure sensor
- Flow meter
- Temperature and humidity sensor
- Any MQTT or HTTP telemetry gateway

## Integration Paths

Path A, via ThingsBoard:

```text
Real sensor or gateway
-> MQTT / HTTP
-> ThingsBoard
-> Rule Chain
-> AgriOS Webhook
-> SensorRecord / DeviceTelemetrySnapshot
-> Mobile /device-integration
```

Path B, direct to AgriOS webhook:

```text
Real sensor or gateway
-> HTTP / MQTT bridge
-> AgriOS Webhook
-> SensorRecord / DeviceTelemetrySnapshot
-> Mobile /device-integration
```

## ThingsBoard Setup

1. Create a ThingsBoard device, for example `FARM-demo-FIELD-A-SOIL-001`.
2. Copy or create its access token.
3. Publish telemetry to `v1/devices/me/telemetry` by MQTT or HTTP.
4. Use a Rule Chain node to forward telemetry to AgriOS:
   `POST /api/v1/iot/thingsboard/telemetry`
5. Set `x-thingsboard-secret` to the configured `THINGSBOARD_WEBHOOK_SECRET`.
6. Bind the device in AgriOS by `thingsboardDeviceId`, device name, or the P13.1 link endpoint.

Example telemetry:

```json
{
  "deviceName": "FARM-demo-FIELD-A-SOIL-001",
  "deviceId": "tb-device-id",
  "telemetry": {
    "soilMoisture": 31.2,
    "soilTemperature": 22.5,
    "batteryPercent": 88,
    "signalStrength": -70
  },
  "ts": 1720000000000
}
```

## Supported Payload Shapes

Wrapped telemetry:

```json
{
  "deviceName": "FARM-demo-FIELD-A-SOIL-001",
  "deviceId": "tb-device-id",
  "telemetry": {
    "soilMoisture": 31.2,
    "soilTemperature": 22.5
  },
  "ts": 1720000000000
}
```

Flat telemetry:

```json
{
  "soilMoisture": 31.2,
  "soilTemperature": 22.5,
  "batteryPercent": 88,
  "signalStrength": -70
}
```

Values wrapper:

```json
{
  "values": {
    "soilMoisture": 31.2,
    "soilTemperature": 22.5
  }
}
```

Common vendor naming:

```json
{
  "temperature": 22.5,
  "humidity": 60,
  "moisture": 31.2
}
```

## Field Mapping

- `moisture` -> `soilMoisture`
- `temp`, `temperature` -> `soilTemperature`
- `humidity` -> `airHumidity` and `humidity`
- `rssi`, `signal`, `signalStrength` -> `signalStrength`
- `battery`, `batteryLevel` -> `batteryPercent`

Unrecognized fields remain in `rawPayload`. The normalized output is stored in `normalizedJson`. Invalid or unprocessable telemetry is sent to IoT Webhook DeadLetter. Successful telemetry writes SensorRecord, attempts DeviceTelemetrySnapshot, and records sync/audit context.

## Binding Helpers

Query candidates:

```http
GET /api/v1/iot/devices/binding-candidates?thingsboardDeviceId=tb-device-id&deviceName=FARM-demo-FIELD-A-SOIL-001
```

Link an AgriOS device:

```http
POST /api/v1/iot/devices/:id/link-thingsboard
Content-Type: application/json

{
  "thingsboardDeviceId": "tb-device-id",
  "thingsboardDeviceName": "FARM-demo-FIELD-A-SOIL-001",
  "telemetryKeys": ["soilMoisture", "soilTemperature"]
}
```

Both endpoints are read/link helpers only. They do not send control commands.

## Acceptance Criteria

- ThingsBoard can show the raw telemetry.
- AgriOS creates a `SensorRecord`.
- AgriOS updates `DeviceTelemetrySnapshot` when an AgriOS device is bound.
- Mobile `/device-integration` shows latest real sensor telemetry.
- Demo status and health endpoints stay healthy.
- No control command is created.

## Verification

Run:

```powershell
apps/backend/scripts/p13_1_real_sensor_telemetry_check.ps1 -BaseUrl http://localhost:3000/api/v1 -FarmId demo
```

The script checks backend health, posts a real-sensor sample payload, reads SensorRecord, reads DeviceTelemetrySnapshot through the latest farm endpoint, checks mobile cockpit and map data, checks latest AI recommendations, and prints PASS / WARN / FAIL.
