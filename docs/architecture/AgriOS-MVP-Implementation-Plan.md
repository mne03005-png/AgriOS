# AgriOS MVP implementation plan

Status: proposed baseline for a 300 mu onion farm  
Scope: monitoring and operator decision support; no automatic pump or valve actuation

## 1. Architecture review

The proposed technology choices are workable, but the MVP should keep clear ownership boundaries:

```text
LoRa sensors
  -> LoRa gateway / device adapter
  -> MQTT broker
  -> ThingsBoard (device identity, connectivity, raw/latest telemetry)
  -> AgriOS ingestion adapter
  -> NestJS business API
  -> MySQL (farms, fields, device bindings, normalized telemetry, alerts, irrigation records)
  -> web/mobile dashboard
```

- NestJS, Prisma, and MySQL are a good fit for farm operations and relational master data.
- ThingsBoard and PostgreSQL should be treated as an IoT subsystem, not as a second business backend. PostgreSQL is owned by ThingsBoard; application code must not query its tables directly.
- MQTT is the device transport. ThingsBoard or an AgriOS adapter validates messages before normalized data reaches the business database.
- LoRa is the field link, not the application protocol. A gateway translates LoRa packets to authenticated MQTT messages.
- For one 300 mu farm, a modular monolith is preferable to microservices. One NestJS deployment, one frontend, one edge process, and explicit module boundaries are sufficient.
- Store normalized readings in MySQL for the MVP and retain raw payloads for diagnosis. Introduce a separate time-series database only after measured retention/query load justifies it.
- Device commands, automatic irrigation, AI optimization, billing, drones, and multi-tenant SaaS are outside this milestone. Irrigation is a human-entered record only.

### Important architecture risks

1. Dual sources of truth: ThingsBoard owns connectivity and raw telemetry; AgriOS owns farm/field bindings and business records.
2. Identity mismatch: every message must resolve an immutable AgriOS `deviceId`; display names must never be identifiers.
3. Unreliable links: ingestion must support duplicate, late, and out-of-order messages using `messageId` and `reportedAt`.
4. LoRa payload size: field payloads should use compact keys/binary encoding; the gateway expands them into the canonical JSON contract.
5. Safety: Milestone 1 is read-only monitoring. No MQTT command subscription or actuator UI is required.

## 2. Canonical repository structure

The repository already uses an npm workspace. Do not create duplicate root applications named `backend/`, `frontend/`, and `device/`; use this mapping:

```text
AgriOS/
├── apps/
│   ├── backend/                 # backend/
│   │   ├── prisma/              # MySQL schema and migrations
│   │   └── src/modules/         # farm, field, device, iot, dashboard
│   ├── mobile/                  # frontend/ (current web/mobile dashboard)
│   ├── native/                  # optional native frontend, not required for MVP acceptance
│   └── edge-agent/              # device/ gateway simulator and field adapter
│       ├── config/
│       └── src/
├── packages/shared/             # shared DTOs, units, topic and telemetry contracts
├── infra/
│   ├── mqtt/                    # broker configuration
│   ├── mysql/
│   └── thingsboard/             # ThingsBoard + its PostgreSQL
└── docs/
```

This satisfies the requested three-way separation without splitting the existing codebase or creating a second backend.

## 3. MVP and first software milestone

### Milestone M1: sensor-to-dashboard vertical slice

Goal: register simulated devices, attach them to onion fields, ingest five sensor measurements over MQTT, persist them, and show current conditions and history on a basic dashboard.

Included:

- farm create/read/update and a seeded 300 mu onion farm;
- field create/read/update with area validation and total-area summary;
- device registration, credentials/status, and field binding;
- sensor channel metadata for soil moisture, temperature, humidity, light, and water flow;
- MQTT telemetry ingestion with validation, deduplication, timestamps, and offline detection;
- normalized telemetry history plus latest-value snapshot;
- threshold alerts with acknowledge/resolve lifecycle;
- manual irrigation records;
- dashboard cards for latest readings, online devices, active alerts, recent history, and data freshness.

Excluded:

- automatic irrigation and remote valve/pump commands;
- advanced GIS, AI recommendations, drone workflows, billing, and multi-farm SaaS features;
- custom ThingsBoard dashboards as the primary product UI;
- long-term analytics and high-availability deployment.

### Acceptance criteria

1. An operator creates one farm and at least three fields whose areas total approximately 300 mu.
2. Five simulated sensor types can be registered and bound to a field.
3. A simulator publishes at least one message every 1–5 minutes through the local MQTT broker.
4. Valid messages appear in latest telemetry within 10 seconds; duplicate `messageId` values do not create duplicate records.
5. Invalid or unknown-device payloads are rejected and logged without stopping ingestion.
6. The dashboard shows device online/offline state, data age, latest values, a 24-hour chart, and active alerts.
7. An operator can record an irrigation event, acknowledge an alert, and reload the page without losing either state.
8. Automated tests cover topic parsing, payload validation, deduplication, device binding, and dashboard aggregation.

## 4. Data model

All records use `id`, `createdAt`, and `updatedAt` unless noted. Values must carry a canonical unit; timestamps are UTC.

| Model | Minimum fields and relationships |
|---|---|
| `Farm` | `name`, `address?`, `totalAreaMu?`; has many fields |
| `Field` | `farmId`, `name`, `areaMu`, `cropType` (onion for the pilot), `location?`; belongs to farm, has devices |
| `Device` | `fieldId?`, immutable `code`, `name`, `type`, `status`, `mqttClientId`, `lastSeenAt?`; belongs to zero or one field |
| `Sensor` | `deviceId`, `key`, `type`, `unit`, `minValue?`, `maxValue?`, `enabled`; a logical measurement channel on a device |
| `Telemetry` | `messageId`, `deviceId`, `sensorId?`, `key`, `value`, `unit`, `reportedAt`, `receivedAt`, `quality`, `rawPayload?`; append-only |
| `Alert` | `farmId`, `fieldId?`, `deviceId?`, `sensorId?`, `type`, `severity`, `status`, `message`, `triggeredAt`, `acknowledgedAt?`, `resolvedAt?` |
| `Irrigation` | `fieldId`, `startTime`, `endTime?`, `waterAmountM3?`, `mode`, `status`, `operatorId?`, `remark?`; manual record in M1 |

### Mapping to the current Prisma schema

- `Farm`, `Field`, and `Device` already exist.
- The requested `Telemetry` role is currently fulfilled by append-only `SensorRecord`; `DeviceTelemetrySnapshot` holds the latest normalized values. Do not add another telemetry table for M1.
- The requested `Irrigation` role is currently fulfilled by `IrrigationRecord`.
- A separate `Sensor` table is optional for M1. With fixed device profiles, sensor-channel metadata can live in shared configuration; add the table only when channels need per-device calibration or enable/disable state.
- Add a small standalone `Alert` model only if persisted acknowledgement/resolution is not already covered by the existing alert services. Avoid using decision-engine or actuator entities for a monitoring alert.

Recommended indexes and constraints:

- unique `Device.code` and MQTT client identity;
- unique `Telemetry.messageId` (the current `SensorRecord.eventId` provides this);
- telemetry indexes on `(deviceId, reportedAt)` and `(fieldId, reportedAt)`;
- alert index on `(farmId, status, triggeredAt)`;
- foreign-key restrictions that prevent deleting a field with bound devices or historical records.

## 5. MQTT contract

### Topics

```text
agrios/v1/farm/{farmId}/device/{deviceId}/telemetry
agrios/v1/farm/{farmId}/device/{deviceId}/status
agrios/v1/farm/{farmId}/device/{deviceId}/event
```

Reserve, but do not implement in M1:

```text
agrios/v1/farm/{farmId}/device/{deviceId}/command/{commandName}
agrios/v1/farm/{farmId}/device/{deviceId}/ack
```

The version prefix enables future evolution. Devices publish only to their own topic; the backend subscribes to `agrios/v1/farm/+/device/+/telemetry` and validates that topic IDs match the authenticated device binding.

### Telemetry payload

```json
{
  "schemaVersion": 1,
  "messageId": "01JDEVICEUNIQUEULID",
  "reportedAt": "2026-08-20T06:30:00.000Z",
  "sequence": 1842,
  "values": {
    "soilMoisturePct": 31.2,
    "airTemperatureC": 26.4,
    "airHumidityPct": 68.0,
    "lightLux": 14200,
    "waterFlowM3h": 3.1
  },
  "batteryPct": 87,
  "rssiDbm": -92
}
```

Rules:

- QoS 1, retained `false` for telemetry; retained `true` for status only.
- Limit payload size and reject unknown top-level schemas.
- `messageId` is required for idempotency; `sequence` helps diagnose missing packets.
- The broker uses per-device credentials and ACLs. Never put secrets in topics or payloads.
- Use a last-will status message for offline detection.

## 6. MVP API

Base path: `/api/v1`. Auth/RBAC is assumed but omitted from the table for clarity.

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/farms` | Create farm |
| `GET` | `/farms` | List accessible farms |
| `GET/PATCH` | `/farms/:farmId` | Read/update farm |
| `POST` | `/fields` | Create field with `farmId` |
| `GET` | `/fields?farmId=` | List farm fields |
| `GET/PATCH` | `/fields/:fieldId` | Read/update field |
| `POST` | `/iot/devices` | Register device |
| `GET` | `/iot/devices?farmId=&fieldId=` | List devices |
| `GET/PATCH` | `/iot/devices/:deviceId` | Read/update device |
| `POST` | `/iot/devices/:deviceId/bind-plot` | Bind device to existing field (legacy route name) |
| `POST` | `/iot/devices/:deviceId/unbind-plot` | Unbind device |
| `GET` | `/iot/devices/:deviceId/telemetry/latest` | Latest values |
| `GET` | `/iot/devices/:deviceId/telemetry/history?from=&to=&keys=` | Time-window history |
| `GET` | `/iot/farms/:farmId/telemetry/summary` | Farm telemetry summary |
| `GET` | `/alerts?farmId=&status=` | List alerts |
| `POST` | `/alerts/:alertId/acknowledge` | Acknowledge alert |
| `POST` | `/alerts/:alertId/resolve` | Resolve alert |
| `POST` | `/irrigation-records` | Create manual irrigation record |
| `GET` | `/irrigation-records?fieldId=&from=&to=` | List irrigation history |
| `GET` | `/dashboard/farms/:farmId` | Basic dashboard aggregate |

MQTT is the normal ingestion API. The existing ThingsBoard webhook may remain as the internal adapter endpoint; it must not become an unauthenticated public device endpoint.

## 7. What to simulate before buying hardware

Everything except radio propagation, sensor accuracy, electrical behavior, and enclosure durability can be exercised first:

- MQTT broker authentication, ACLs, retained status, QoS 1, reconnects, and last will;
- hundreds of logical devices using `apps/edge-agent` or a script, including normal, dry, hot, offline, low-battery, duplicate, delayed, and malformed scenarios;
- LoRa gateway output by replaying captured/defined byte payloads through a codec into MQTT;
- packet loss, latency, out-of-order delivery, clock drift, and network outages;
- device registration and field binding;
- telemetry normalization, unit conversion, idempotency, storage, retention, charts, alerts, and CSV export;
- ThingsBoard device provisioning, rule chains, webhook retry, and PostgreSQL lifecycle;
- the complete demo on seeded farm/field data.

Hardware is still required to validate LoRa coverage across 300 mu, antenna placement, soil-probe calibration, flow-meter pulse constants, solar/battery sizing, waterproofing, lightning protection, and installation/maintenance procedures.

## 8. Development sequence

Build one end-to-end path before adding breadth:

1. Freeze the telemetry schema, units, topic parser, ownership rules, and M1 acceptance tests.
2. Run MySQL, MQTT, and ThingsBoard locally; document secrets and ports through environment examples.
3. Complete farm, field, and device registration/binding APIs using the current Prisma schema.
4. Implement one simulated soil-moisture device through MQTT to normalized `SensorRecord` plus latest snapshot.
5. Add the dashboard latest-value card and freshness/online indicator for that one device.
6. Generalize the same path to temperature, humidity, light, and water flow; do not create five ingestion pipelines.
7. Add 24-hour history, threshold evaluation, persisted alert lifecycle, and manual irrigation records.
8. Add failure tests for duplicate, stale, invalid, unknown, offline, and reconnect scenarios.
9. Perform a week-long simulator soak test and measure database growth and dashboard query time.
10. Buy and integrate one gateway plus one representative sensor node; validate the field link before scaling hardware purchases.

### Suggested delivery slices

- Week 1: contracts, local infrastructure, seed farm/fields, registration APIs.
- Week 2: one-device MQTT vertical slice and persistence.
- Week 3: five measurements, dashboard, history, offline state.
- Week 4: alerts, manual irrigation records, automated tests, soak test, installation checklist.

M1 ends after the simulator-backed acceptance criteria pass. Real actuator work begins in a separate milestone with an explicit safety review.
