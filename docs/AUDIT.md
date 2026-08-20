# OpenAgriOS v0.1-alpha — Repository Audit

Performed before any implementation work, per the release sprint instructions. This records what
already exists, what is reused as-is, and what is net-new for the alpha release, so the decisions
below are traceable.

## What already exists (much more than a greenfield project)

AgriOS is not a prototype. `README.md`'s existing phase log (P6–P13.2) documents a mature backend:
multi-tenant auth/RBAC, a safety-gated decision engine (`ActionPlan` → `ActionExecution` →
physical confirmation), ThingsBoard sync, an edge gateway, Bluetooth maintenance mode, drone data
import, irrigation rotation/fertigation, and a real electric-valve dry-run control loop. This is
the system being *opened up*, not replaced.

### Core entities the alpha needs — all already exist

| Alpha entity | Existing model / concept | Notes |
|---|---|---|
| Farm | `Farm` (`prisma/schema.prisma`) | Already has `name`, `type`, tenant scoping. |
| Field | `Field` | Already has `areaMu`, farm relation. |
| Device | `Device` | `type: DeviceType` includes `SOIL_SENSOR`, `WEATHER_SENSOR`, etc. — "Sensor" is a `Device` with a sensor `type`, not a separate table. |
| Telemetry | `SensorRecord` | Already has dedicated `soilMoisture` / `temperature` / `humidity` / `battery` columns, plus a generic `type`/`value` pair. |
| Alert | `SafetyAlert` | Already generic: `severity`, `alertType: String` (free text), `message`, `status`, `metadata` — reusable for simple threshold alerts without inventing a parallel table. |

**Decision: no new Prisma models.** All five alpha entities map onto existing tables. This is the
single biggest scope reduction versus a from-scratch build.

### MQTT — already implemented, but gated for production safety, not a demo

`src/modules/mqtt/mqtt.service.ts` already ingests telemetry, but only connects when
`DEVICE_CONTROL_MODE=MQTT_DIRECT` (default is `MOCK`, i.e. **no MQTT connection by default**) —
that gate exists because this service also carries the device-*command* path, which is
safety-relevant. Reusing it as-is for an always-on public telemetry demo would mean either
weakening a safety-relevant gate or silently changing its behavior — both are out of scope.

**Decision:** add a new, separate, read-only MQTT ingestion service (`modules/open-agrios/`) on
its own versioned topic (`agrios/v1/...`, see `docs/mqtt-spec.md`), independent of
`DEVICE_CONTROL_MODE`. It never publishes commands and never touches `DeviceControlModule`,
`SafetyModule`, or `ActionQueueModule`.

### REST APIs — already implemented, but all require JWT + tenant context

`FarmController`, `FieldController`, `DeviceController`, and `IotController` (`/iot/devices/:id/
telemetry/latest`, `/iot/farms/:farmId/telemetry/summary`, etc.) already cover farm/field/device/
telemetry querying — behind `JwtAuthGuard` + `TenantGuard` (+ `PermissionsGuard` for most of
`IotController`). The alpha's explicit scope excludes "complex authentication," and a fresh
`git clone && docker compose up` visitor has no account to log in with.

**Decision:** add a small set of new, unauthenticated, read-only endpoints
(`GET /api/v1/open/...`) that proxy the same underlying data for the demo dashboard only. The
existing authenticated APIs are untouched.

### Demo data — a full demo farm already exists, but it isn't the alpha's demo

`prisma/seed-demo-farm.ts` already seeds farm id `demo` ("洋葱智慧农场 Demo", fields 洋葱A区/
洋葱B区/玉米试验区) and is wired into `apps/mobile`'s default farm id, several docs, and
PowerShell smoke scripts. Repurposing or renaming it would ripple across all of that.

**Decision:** add a second, independent seed (`prisma/seed-openagrios-demo.ts`) for the OSS-facing
demo (`Jingshan Farm` / `Onion Field 01` / `sensor-001`), upserted by fixed id so it's idempotent
and additive — the existing `demo` farm is untouched.

### Existing infra worth reusing directly

- `infra/docker/docker-compose.yml` — local MySQL + Mosquitto, confirms the working pattern.
- `apps/backend/Dockerfile` — multi-stage build already produces a working production image;
  reused as-is for the alpha's `backend` service.
- `docker-compose.p12.yml` — confirms the MySQL env var / health-check pattern reused below.

## Deviations from the literal release brief, and why

- **Database: MySQL, not PostgreSQL.** The brief's Docker services list says PostgreSQL, but the
  entire existing schema, ~30 migrations, and the seed/demo tooling are MySQL (`schema.prisma`:
  `provider = "mysql"`). Migrating to Postgres the night before a release is exactly the kind of
  rewrite the brief itself says not to do ("do not rewrite working code," "do not over-engineer").
  Keeping MySQL is a deliberate call, flagged here rather than silently swapped in either
  direction.
- **`device/simulator` at repo root, not under `apps/`.** The brief names this exact path twice;
  honored literally even though the rest of the monorepo uses `apps/*`. It does not conflict with
  anything (there is no existing `device/` directory), so it is purely additive.
- **Dashboard reuses neither `apps/mobile` nor `apps/web-admin`.** Both are real, non-trivial apps
  (`apps/mobile` is JWT-gated and multi-page; `apps/web-admin` currently ships only a `README.md`
  and a `dist/`, no visible source to build on). Building the alpha demo on top of either would
  pull in exactly the complexity ("enterprise permissions," full auth) the brief excludes. A new,
  intentionally minimal `apps/dashboard/` (static HTML/JS, no build step, no auth) is added instead
  — this is not a duplicate application, it has no other purpose than rendering the `/api/v1/open/*`
  read endpoints.

## What is explicitly not touched

`SafetyModule`, `DeviceControlModule`, `ActionQueueModule`, `ApprovalModule`, `AiDecisionModule`,
`EdgeGatewayModule`, `BluetoothModule`, the existing `MqttModule`/`MqttService`, `apps/mobile`,
`apps/native`, `apps/edge-agent`, and every existing migration. Nothing in this release changes
`ENABLE_AUTO_EXECUTION`, `DEVICE_CONTROL_MODE`, or any real-write gate.
