# AgriOS P13 Edge Controller API Spec

The P13 Edge Controller API is a lab contract for local and future field gateways. The included simulator returns mock ACK only and never touches real hardware.

## Base URL

```text
http://localhost:18080
```

AgriOS environment example:

```env
DEVICE_CONTROL_MODE=EDGE_HTTP
EDGE_CONTROLLER_BASE_URL=http://localhost:18080
EDGE_CONTROLLER_TOKEN=REPLACE_WITH_RANDOM_TOKEN
ENABLE_AUTO_EXECUTION=false
```

## Health

```text
GET /health
```

Response:

```json
{
  "ok": true,
  "simulated": true,
  "message": "P13 Edge controller simulator is running"
}
```

## Command Endpoints

```text
GET  /devices
GET  /devices/:deviceCode/status
POST /commands/openValve
POST /commands/closeValve
POST /commands/startPump
POST /commands/stopPump
POST /commands/setValveOpening
POST /commands/setPumpFrequency
POST /commands/startFertigation
POST /commands/stopFertigation
POST /commands/startDissolving
POST /commands/stopDissolving
POST /commands/emergencyStop
```

Field-style aliases are also supported by the P13 simulator:

```text
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

Request:

```json
{
  "deviceId": "demo-valve-001",
  "requestId": "p13-smoke-001",
  "payload": {
    "openingPercent": 50,
    "durationMinutes": 3
  }
}
```

Response:

```json
{
  "ok": true,
  "simulated": true,
  "command": "openValve",
  "deviceId": "demo-valve-001",
  "requestId": "p13-smoke-001",
  "ackAt": "2026-07-02T00:00:00.000Z",
  "message": "Mock ACK only. No hardware was controlled."
}
```

## Status

```text
GET /status/:deviceId
GET /devices/:deviceCode/status
```

Response:

```json
{
  "ok": true,
  "simulated": true,
  "deviceId": "demo-valve-001",
  "online": true,
  "lastCommand": "openValve"
}
```

## Safety Contract

- The simulator can be used for command routing tests only.
- Production execution must be protected by field safety policy, emergency stop, installer check, and manual approval where required.
- P13.0 does not enable unattended automatic irrigation.
