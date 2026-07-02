# AgriOS P13 Device Protocol Spec

This document defines the simulation and field-integration protocol shape for AgriOS P13.0. It is intentionally conservative: telemetry can be accepted automatically, but physical execution still requires Safety / Approval / ActionQueue / DeviceControl.

## Telemetry Keys

## Device Types

AgriOS P13 uses these field device categories as the first integration baseline:

- `SOIL_SENSOR`
- `PRESSURE_SENSOR`
- `FLOW_METER`
- `ELECTRIC_VALVE`
- `PUMP_CONTROLLER`
- `FERTIGATION_MACHINE`
- `FERTILIZER_TANK`
- `WEATHER_STATION`
- `GATEWAY`
- `EDGE_CONTROLLER`

## Telemetry Fields

Soil sensor:

- `soilMoisture`
- `soilTemperature`
- `batteryPercent`
- `signalStrength`

Pressure sensor:

- `pressureKpa`
- `batteryPercent`
- `signalStrength`

Flow meter:

- `flowRateM3h`
- `totalFlowM3`

Electric valve:

- `valveStatus`
- `valveOpeningPercent`
- `valveErrorCode`
- `batteryPercent`
- `signalStrength`

Pump controller:

- `pumpStatus`
- `pumpFrequencyHz`
- `pumpCurrentA`
- `pumpVoltageV`
- `pumpErrorCode`

Fertigation:

- `fertigationStatus`
- `fertilizerTankLevelL`
- `injectionRateLh`
- `ec`
- `ph`

Gateway:

- `gatewayOnline`
- `signalStrength`
- `lastSeenAt`
- `firmwareVersion`

## Unified Telemetry Payload

Recommended normalized telemetry payload:

```json
{
  "deviceName": "demo-soil-sensor-a",
  "thingsboardDeviceId": "tb-demo-soil-a",
  "ts": 1782780000000,
  "values": {
    "soilMoisture": 31,
    "temperature": 32,
    "humidity": 64,
    "pressureKpa": 180,
    "flowRateM3h": 12.5,
    "valveOpeningPercent": 80,
    "pumpFrequencyHz": 35,
    "fertilizerTankLevelL": 320,
    "batteryPercent": 88,
    "signalStrength": -62
  }
}
```

## MQTT Topics

Local MQTT simulator topics:

```text
agrios/device/{deviceCode}/telemetry
agrios/device/{deviceCode}/status
agrios/device/{deviceCode}/ack
agrios/device/{deviceCode}/command
```

Telemetry example:

```json
{
  "soilMoisture": 32,
  "temperature": 31,
  "humidity": 66,
  "pressureKpa": 185,
  "flowRateM3h": 11.8,
  "timestamp": "2026-07-02T08:00:00.000Z"
}
```

ACK example:

```json
{
  "requestId": "demo-request-001",
  "status": "ACKED",
  "message": "Mock command accepted"
}
```

## Edge HTTP Commands

The P13 Edge simulator accepts mock commands only:

```text
POST /commands/openValve
POST /commands/closeValve
POST /commands/startPump
POST /commands/stopPump
POST /commands/setValveOpening
POST /commands/setPumpFrequency
POST /commands/startFertigation
POST /commands/stopFertigation
POST /commands/emergencyStop
GET  /status/:deviceId
GET  /health
```

The simulator also accepts the field-style endpoint aliases:

```text
GET  /devices
GET  /devices/:deviceCode/status
POST /commands/open-valve
POST /commands/close-valve
POST /commands/set-valve-opening
POST /commands/start-pump
POST /commands/stop-pump
POST /commands/set-pump-frequency
POST /commands/start-fertigation
POST /commands/stop-fertigation
POST /commands/emergency-stop
```

Command categories:

- Valve: `openValve`, `closeValve`, `setValveOpening`
- Pump: `startPump`, `stopPump`, `setPumpFrequency`
- Fertigation: `startFertigation`, `stopFertigation`, `setInjectionRate`
- Safety: `emergencyStop`

Request shape:

```json
{
  "deviceId": "demo-pump-001",
  "requestId": "local-test-001",
  "payload": {
    "durationMinutes": 5
  }
}
```

Response shape:

```json
{
  "success": true,
  "simulated": true,
  "deviceCode": "demo-pump-001",
  "commandId": "local-test-001",
  "status": "ACKED",
  "timestamp": "2026-07-02T00:00:00.000Z"
}
```

The local simulator also returns extra debugging fields:

```json
{
  "ok": true,
  "simulated": true,
  "command": "startPump",
  "deviceId": "demo-pump-001",
  "message": "Mock ACK only. No hardware was controlled."
}
```

## Anomaly Simulation

Supported anomaly modes:

- `low-pressure`: pressure below normal threshold.
- `no-flow`: pump/valve may appear active while flow is zero.
- `offline`: device periodically sends offline status.

These anomalies are used to test monitoring, AI recommendation, audit, and mobile debug views.
