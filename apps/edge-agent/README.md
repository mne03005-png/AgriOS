# AgriOS Edge Agent

Standalone Node.js runtime for Linux Edge computers. It reuses the single `@agrios/edge-core` reliability implementation for persistent telemetry, replay, command deduplication, expiry and ACK recovery.

```bash
npm --workspace @agrios/edge-core run build
npm --workspace @agrios/edge-agent run build
EDGE_CONFIG_PATH=/etc/agrios-edge/edge.config.json node apps/edge-agent/dist/main.js
```

The checked-in configuration is an example only. Machine certificate/private-key/HMAC files are provisioned outside the repository with least privilege. Do not use a user password or platform JWT.

The default PLC transport is `FAKE`, and real writes are disabled. A MODBUS_TCP configuration alone never enables writes: all six existing environment gates plus an approved real profile and the config safety gate must be true. P0 Runtime tests use only the fake MQTT and fake PLC transports.
