# OpenAgriOS MQTT Spec — v0.1-alpha

Scope: the demo telemetry pipeline only (`Sensor Simulator -> MQTT Broker -> Backend -> Database
-> Dashboard`). This is a new, versioned, read-only topic namespace, independent of the existing
production device-command path (`src/modules/mqtt/`, topic `agrios/device/{code}/...`), which
remains unchanged and is not part of the alpha demo. See [`docs/AUDIT.md`](AUDIT.md) for why the
two are kept separate.

## Topic structure

```
agrios/v1/farm/{farmId}/device/{deviceId}/telemetry
```

- `v1` — schema/topic version. A future breaking change gets `v2` alongside `v1`, not a silent
  replacement.
- `{farmId}` — the farm the device belongs to (e.g. `openagrios-demo-farm`).
- `{deviceId}` — the device's stable code (e.g. `sensor-001`). This is the same value the backend
  stores as `Device.code`; it is never a display name.

The backend subscribes to the wildcard `agrios/v1/farm/+/device/+/telemetry` and validates that
the payload's `deviceId` matches the topic's `{deviceId}` segment before accepting the message.

Reserved for a future phase, not implemented in v0.1-alpha:

```
agrios/v1/farm/{farmId}/device/{deviceId}/status
agrios/v1/farm/{farmId}/device/{deviceId}/command/{commandName}
```

## Payload format

```json
{
  "deviceId": "sensor-001",
  "fieldId": "openagrios-demo-field-01",
  "timestamp": "2026-08-20T00:00:00Z",
  "status": "online",
  "data": {
    "soilMoisture": 35,
    "temperature": 28,
    "humidity": 70,
    "battery": 95
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `deviceId` | string | yes | Must match the topic's `{deviceId}` segment |
| `fieldId` | string | no | If present and the device is unbound, the backend binds it on first message |
| `timestamp` | ISO 8601 string | no | Defaults to server receive time if missing or unparseable |
| `status` | `"online"` \| `"offline"` | no | Defaults to `"online"` |
| `data.soilMoisture` | number (%) | no\* | |
| `data.temperature` | number (°C) | no\* | |
| `data.humidity` | number (%) | no\* | |
| `data.battery` | number (%) | no\* | |

\* At least one numeric field under `data` is required; a message with no metrics is rejected.

## Validation

The backend rejects (logs and drops, does not crash the ingestion loop) any message that:

- is not valid JSON;
- is missing `deviceId`, or whose `deviceId` does not match the topic;
- has a `data` object with no numeric metrics.

This is intentionally basic for the alpha (matches the "do not over-engineer" release scope). It
does not yet include the idempotency envelope (`messageId`/`sequence`) proposed for a later
milestone in `docs/architecture/AgriOS-MVP-Implementation-Plan.md` — worth revisiting once the
demo moves past a single simulated device per field.

## Device communication flow

```
1. Sensor Simulator (device/simulator) generates a reading every 5s
2. Publishes JSON to agrios/v1/farm/{farmId}/device/{deviceId}/telemetry (QoS 0, not retained)
3. MQTT broker (Mosquitto) delivers to all subscribers
4. Backend's OpenAgriosMqttService (apps/backend/src/modules/open-agrios/) receives it:
     a. validates the payload
     b. upserts the Device (auto-registers on first message; marks online; records lastTelemetryAt)
     c. writes a SensorRecord row
     d. evaluates simple fixed thresholds (soil moisture < 20%, battery < 15%) and raises a
        SafetyAlert if one isn't already open for that device/type
     e. a 15s interval separately marks any device silent for >30s as offline and raises a
        DEVICE_OFFLINE alert
5. Dashboard (apps/dashboard) polls GET /api/v1/open/farms/{farmId}/snapshot every few seconds
   and renders farm / field / device / latest telemetry / open alerts
```

## Auth

The alpha's local Mosquitto broker runs with `allow_anonymous true` — appropriate for a local
demo, not for a production deployment. Real per-device credentials/ACLs are a Phase 2 hardening
item (see `docs/roadmap.md`), tracked alongside real hardware onboarding.

## Extending toward real hardware (not built in v0.1-alpha)

For LoRa-based nodes, the field link is LoRa, not MQTT — a gateway decodes LoRa packets and
republishes them as MQTT messages on this same topic contract, so nothing above this line changes
when real sensors replace the simulator. See `docs/roadmap.md` Phase 2.
