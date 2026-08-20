# OpenAgriOS Sensor Simulator

Hardware-free MQTT sensor simulator for the OpenAgriOS v0.1-alpha demo pipeline:

```
Sensor Simulator -> MQTT Broker -> Backend -> Database -> Dashboard
```

It publishes soil moisture, temperature, humidity, battery level, and online status every 5
seconds, on the versioned topic documented in [`docs/mqtt-spec.md`](../../docs/mqtt-spec.md).

## Run with Docker Compose (recommended)

Started automatically by the root `docker compose up` — see the repository root `README.md`.

## Run standalone

```bash
cd device/simulator
npm install
MQTT_BROKER_URL=mqtt://localhost:1883 npm start
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `MQTT_BROKER_URL` | `mqtt://localhost:1883` | Broker to connect to |
| `FARM_ID` | `openagrios-demo-farm` | Must match the seeded demo farm id |
| `FIELD_ID` | `openagrios-demo-field-01` | Must match the seeded demo field id |
| `DEVICE_ID` | `sensor-001` | Device code — the backend auto-registers a `Device` on first message if it doesn't already exist |
| `INTERVAL_MS` | `5000` | Publish interval |
| `SCENARIO` | `normal` | `normal` (steady) or `offline` (periodically drops messages, to exercise offline detection) |

Run a second, independently-configured instance to simulate a second device:

```bash
DEVICE_ID=sensor-002 SCENARIO=offline npm start
```
