# AgriOS P13 Real Device Integration Plan

P13.0 focuses on a field-ready integration plan and a safe hardware simulation kit. It does not change the existing ThingsBoard webhook ingestion flow and does not directly control real pumps, valves, PLCs, or drones.

## Positioning

- ThingsBoard remains the device room for device access, telemetry, dashboards, and rule-chain forwarding.
- AgriOS remains the agricultural cockpit for farm data, safety policy, approval, action queue, device-control routing, AI recommendations, audit, and mobile demo.
- Real device execution must pass through Safety / Approval / ActionQueue / DeviceControl.
- The default safe mode is still `DEVICE_CONTROL_MODE=MOCK` and `ENABLE_AUTO_EXECUTION=false`.

## Integration Stages

1. Simulation verification
   - Use `thingsboard-telemetry-simulator.ts` to POST mock telemetry into AgriOS.
   - Use `mqtt-device-simulator.ts` to publish MQTT telemetry to a local broker.
   - Use `edge-controller-simulator.ts` to receive mock Edge HTTP commands and return ACK only.

2. ThingsBoard lab verification
   - Start ThingsBoard locally or in a test tenant.
   - Import the AgriOS telemetry forwarding rule-chain template.
   - Configure webhook URL as `PUBLIC_API_URL/api/v1/iot/thingsboard/telemetry`.
   - Use a non-secret example in templates; real webhook secret stays in environment variables.

3. Edge controller lab verification
   - Run the Edge simulator at `http://localhost:18080`.
   - Configure AgriOS with `DEVICE_CONTROL_MODE=EDGE_HTTP`.
   - Configure `EDGE_CONTROLLER_BASE_URL=http://localhost:18080`.
   - Keep `ENABLE_AUTO_EXECUTION=false`.

4. Field pilot
   - Bind each device to farm/field after installer check.
   - Validate pressure, flow, valve, pump, and telemetry snapshots.
   - Validate emergency stop and manual override process.
   - Confirm all risky operations are auditable.

## Safety Rules

- Do not bypass ActionQueue for dangerous operations.
- Do not run auto execution until field hardware, emergency stop, and water pressure/flow safety are verified.
- P13.0 simulation scripts do not control real hardware.
- Pump/valve command examples are for mock Edge controller only.

## Recommended Environment

```env
DEVICE_CONTROL_MODE=MOCK
ENABLE_AUTO_EXECUTION=false
THINGSBOARD_WEBHOOK_SECRET=replace_with_local_secret
EDGE_CONTROLLER_BASE_URL=http://localhost:18080
EDGE_CONTROLLER_TOKEN=REPLACE_WITH_RANDOM_TOKEN
```

Do not commit real passwords, tokens, device secrets, or access tokens.

## Verification Entry Points

- Backend health: `GET /api/v1/health/ready`
- Telemetry webhook: `POST /api/v1/iot/thingsboard/telemetry`
- Farm telemetry summary: `GET /api/v1/iot/farms/demo/telemetry/summary`
- AI recommendations: `GET /api/v1/ai-recommendations?farmId=demo`
- Device control mode: `GET /api/v1/device-control/mode/status`
- Mobile debug page: `/device-integration`

