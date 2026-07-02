# AgriOS P13.2 Electric Valve Controller Integration

## Goal

P13.2 establishes the first safe control loop for an electric valve controller. The default mode is dry-run. It validates command creation, queueing, ACK handling, telemetry feedback, and mobile diagnostics without opening a real valve or starting a pump.

## Dry-Run vs Real Execution

Dry-run:

- Does not call a real adapter.
- Records `DeviceCommand`, `ActionExecution`, `ActionQueueJob`, `AuditEvent`, and `EventLog`.
- Generates a simulated `ACCEPTED / ACKED` result.
- Updates valve status only as simulated device state.

Real execution:

- Requires `DEVICE_CONTROL_DRY_RUN=false`.
- Requires `VALVE_ALLOW_REAL_CONTROL=true`.
- Requires adapter configuration, explicit approval, safety pass, and ActionQueue.
- Must receive ACK feedback before it is considered successful.

## Control Paths

ThingsBoard Cloud:

```text
AgriOS -> Safety -> Approval -> ActionQueue -> DeviceControl -> ThingsBoard RPC -> Gateway -> Valve Controller
```

Edge Local:

```text
AgriOS -> Safety -> Approval -> ActionQueue -> DeviceControl -> Edge HTTP -> Local Gateway / PLC -> Valve Controller
```

MQTT Direct:

```text
AgriOS -> Safety -> Approval -> ActionQueue -> DeviceControl -> MQTT Broker -> Valve Controller
```

Bluetooth remains for installation, configuration, nearby testing, and maintenance. It is not the normal daily control path.

## Unified Valve Protocol

Commands:

- `OPEN`
- `CLOSE`
- `SET_OPENING`
- `READ_STATUS`
- `TEST_OPEN`

Request fields:

```json
{
  "commandId": "valve-command-id",
  "tenantId": "tenant-id",
  "farmId": "demo",
  "fieldId": "demo-field-onion-a",
  "deviceId": "device-id",
  "deviceCode": "demo-valve-001",
  "commandType": "TEST_OPEN",
  "openingPercent": 5,
  "testDurationSeconds": 3,
  "requestedBy": "user-id",
  "dryRun": true,
  "requestedAt": "2026-07-02T00:00:00.000Z",
  "timeoutMs": 10000
}
```

ACK fields:

```json
{
  "commandId": "valve-command-id",
  "deviceId": "device-id",
  "accepted": true,
  "status": "ACKED",
  "valveStatus": "OPEN",
  "valveOpeningPercent": 5,
  "errorCode": null,
  "errorMessage": null,
  "timestamp": "2026-07-02T00:00:01.000Z"
}
```

Safety rules include:

- Device must be a valve.
- Device must be bound to a farm and field.
- Viewer cannot execute.
- Real control is rejected unless explicitly enabled.
- Feedback is required for real control.
- Opening percent must be 0-100.
- `TEST_OPEN` is capped by `VALVE_MAX_OPEN_SECONDS`, maximum 30 seconds.
- Emergency stop blocks open/test-open/set-opening.
- Repeated open commands are blocked while a valve command is still pending/sent.
- Opening a valve never starts a pump.

Representative error codes:

- `VALVE_OFFLINE`
- `VALVE_NOT_BOUND`
- `VALVE_FEEDBACK_REQUIRED`
- `VALVE_ALREADY_EXECUTING`
- `EMERGENCY_STOP_ACTIVE`
- `REAL_CONTROL_DISABLED`
- `DRY_RUN_ONLY`
- `PERMISSION_DENIED`

## Feedback API

```http
POST /api/v1/device-control/valves/feedback
```

Payload:

```json
{
  "commandId": "valve-command-id",
  "deviceId": "device-id",
  "deviceCode": "demo-valve-001",
  "valveStatus": "OPEN",
  "valveOpeningPercent": 5,
  "success": true,
  "errorCode": null,
  "errorMessage": null,
  "timestamp": "2026-07-02T00:00:01.000Z"
}
```

Duplicate ACK is idempotent. Missing `commandId` creates a dead-letter style event/audit record. Feedback updates `DeviceCommand`, `ActionExecution`, and device `currentStatus`.

## APIs

```text
POST /api/v1/device-control/valves/:deviceId/open
POST /api/v1/device-control/valves/:deviceId/close
POST /api/v1/device-control/valves/:deviceId/set-opening
POST /api/v1/device-control/valves/:deviceId/test-open
GET  /api/v1/device-control/valves/:deviceId/status
GET  /api/v1/device-control/valves/:deviceId/commands
POST /api/v1/device-control/valves/feedback
```

Control APIs use `JwtAuthGuard`, `TenantGuard`, and `PermissionsGuard`. Feedback is intentionally callable by ThingsBoard Rule Chain / Edge / MQTT bridge.

## Templates and Simulator

Templates:

- `templates/thingsboard/device-profiles/electric-valve-profile.json`
- `templates/thingsboard/rule-chains/agrios-valve-command-feedback-rule-chain.json`

Simulator:

```powershell
npm run sim:p13:valve --workspace apps/backend
npm run sim:p13:valve:failure --workspace apps/backend
npm run sim:p13:valve:timeout --workspace apps/backend
```

The simulator only emits mock ACK/status and never controls hardware.

## Verification

```powershell
apps/backend/scripts/p13_2_valve_dry_run_check.ps1 -BaseUrl http://localhost:3000/api/v1
```

The script checks health, dry-run defaults, demo valve lookup, test-open dry-run, safety result, queue/job/command/execution records, feedback idempotency, invalid opening rejection, metrics, and confirms no pump endpoint is called.
