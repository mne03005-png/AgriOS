# P0 Edge Runtime Acceptance

## Acceptance state

- EDGE RELIABILITY ENGINE = YES
- STANDALONE EDGE RUNTIME = YES
- EDGE MQTT TRANSPORT = YES
- MQTT TLS CAPABLE = YES
- PERSISTENT STORE = YES
- OFFLINE REPLAY = YES
- COMMAND DEDUP = YES
- ACK PERSISTENCE = YES
- PROCESS RESTART RECOVERY = YES
- GRACEFUL SHUTDOWN = YES
- REAL PLC CONNECTED = NO
- REAL MODBUS WRITE = NO
- REAL HARDWARE ENABLED = NO

## Architecture

`apps/edge-agent` is an independent Node.js workspace and process. The reliability and Modbus TCP transport implementations were moved, not copied, into `packages/edge-core`; backend validation and Edge Runtime both import those single shared implementations. The backend retains only a thin Nest configuration wrapper. The runtime is separated into configuration, MQTT, device-control, persistence/reliability, orchestration, health and lifecycle files.

The formal command path is MQTT receive, JSON parse, edge/tenant/farm/device scope validation, machine HMAC validation, expiry policy, persistent commandId deduplication, Edge DeviceControl/PLC transport port, persistent ACK and QoS1 ACK publish. No MQTT handler directly writes Modbus.

The shared MQTT contract preserves the existing device topics:

- `agrios/device/{deviceId}/telemetry`
- `agrios/device/{deviceId}/command`
- `agrios/device/{deviceId}/ack`
- `agrios/edge/{edgeId}/status` for Edge health

The production transport supports MQTT TLS certificate paths, QoS 1, command subscription, telemetry/ACK/health publishing, capped exponential reconnect with jitter, connection state and graceful disconnect. Tests use the fake local-file transport only.

## Safety and credentials

Configuration fails closed without edge, tenant, farm, MQTT endpoint/machine credential path or storage path. Machine certificate/key/HMAC paths are separate from user authentication. Logs and evidence never output credential contents. Edge scope is limited to configured tenant, farm and devices.

The default PLC transport is FAKE. The config gate, existing six environment gates and a valid approved REAL profile are all required for theoretical write eligibility. Every P0 Runtime test has real write disabled. No real broker, PLC, LOGO, Modbus write, database, Redis, Docker or production service was used.

## Runtime E2E

The E2E starts compiled `dist/main.js` child processes. The first process captures base telemetry and commands while offline. A second process begins replay and is forcibly terminated only after a persisted SENDING state is observed. A third process opens the same store, restores SENDING to PENDING, drains ACKs before telemetry and completes replay. The suite separately invokes the same shutdown routine used by SIGTERM/SIGINT and verifies the store remains valid.

Measured acceptance:

- base telemetry: 1000 generated / 1000 unique received / 0 lost / 0 duplicate business records
- commands: 100 generated
- duplicate physical execution: 0
- expired dangerous execution: 0
- invalid scope execution: 0
- invalid authentication execution: 0
- lost STOP: 0
- lost ACK: 0
- final queue depth: 0
- restart recovery: PASS
- graceful shutdown: PASS

Runtime weak-network child-process profiles cover actual fake delays of 100 ms, 500 ms and 2 seconds, plus 5%, 20% and 50% simulated delivery failures followed by recovery. Machine-readable JSON and Markdown evidence are generated beneath `artifacts/validation/` from the producer, persistent store, fake MQTT cloud, execution journal and outcome journal.
