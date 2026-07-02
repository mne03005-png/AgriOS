# AgriOS P13 ThingsBoard RuleChain Test Guide

P13.0 keeps the existing AgriOS ThingsBoard webhook unchanged. The rule-chain template only forwards telemetry into:

```text
POST /api/v1/iot/thingsboard/telemetry
```

## Local Test

1. Start AgriOS backend.
2. Set `THINGSBOARD_WEBHOOK_SECRET` in backend `.env`.
3. Run the direct webhook simulator:

```powershell
cd apps/backend
npx ts-node scripts/simulators/thingsboard-telemetry-simulator.ts
```

4. Verify:

```text
GET /api/v1/iot/farms/demo/telemetry/summary
GET /api/v1/sensor-records?farmId=demo&pageSize=5
GET /api/v1/demo/health?farmId=demo
```

## ThingsBoard Rule Chain

Template path:

```text
templates/thingsboard/rule-chains/agrios-telemetry-forwarding-rule-chain.json
```

Important placeholders:

- `PUBLIC_API_URL`: AgriOS public API base URL.
- `THINGSBOARD_WEBHOOK_SECRET`: configured in ThingsBoard rule-chain metadata or node headers, not committed to source control.

Expected forwarding target:

```text
${PUBLIC_API_URL}/api/v1/iot/thingsboard/telemetry
```

## ThingsBoard Device Setup

1. Create a test device in ThingsBoard, for example `demo-soil-sensor-a`.
2. Copy its MQTT access token from the ThingsBoard device credentials page.
3. Publish telemetry to the ThingsBoard MQTT port in a lab environment.
4. Configure the rule-chain REST node to forward the payload to AgriOS.
5. Keep the real access token and webhook secret outside this repository.

Example ThingsBoard MQTT topic:

```text
v1/devices/me/telemetry
```

Example telemetry:

```json
{
  "soilMoisture": 31,
  "temperature": 30,
  "pressureKpa": 185,
  "flowRateM3h": 12.2
}
```

## Payload Mapping

ThingsBoard device metadata should include:

```json
{
  "deviceName": "${deviceName}",
  "thingsboardDeviceId": "${deviceId}"
}
```

Telemetry values should be forwarded under `values`, while commonly used values may also be flattened by the simulator for compatibility.

## Failure Handling

- Invalid secret returns unauthorized.
- Malformed payloads may create IoT webhook dead letters.
- Missing device binding still allows telemetry storage when the backend can resolve the device; irrigation advice may be skipped if field binding is missing.
- Telemetry key mismatch should be fixed in the ThingsBoard transform node or the AgriOS normalizer mapping.
- Dead letters can be replayed from `/api/v1/iot/webhook-dead-letters/:id/retry`.

## AgriOS Checks

```text
GET /api/v1/sensor-records?farmId=demo&pageSize=5
GET /api/v1/iot/farms/demo/telemetry/summary
GET /api/v1/iot/webhook-dead-letters
GET /api/v1/demo/health?farmId=demo
```

P13.0 does not auto-open pumps or valves from telemetry.
