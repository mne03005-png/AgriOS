# Changelog

All notable changes to the **public OpenAgriOS release** are recorded here. This tracks the OSS
alpha and its successors, not the much longer internal AgriOS development history — see
[`docs/DEVELOPMENT_LOG.md`](docs/DEVELOPMENT_LOG.md) for that.

## v0.1-alpha — 2026-08-20

First public release. Runnable, demonstrable, contributor-friendly — not a complete commercial
platform (see [`ROADMAP.md`](ROADMAP.md) for what's deliberately deferred).

### Added

- Digital twin demo pipeline: Sensor Simulator → MQTT → Backend → MySQL → Dashboard, using the
  existing `Farm`/`Field`/`Device`/`SensorRecord`/`SafetyAlert` models — no new Prisma models.
- `apps/backend/src/modules/open-agrios/`: versioned MQTT telemetry ingestion
  (`agrios/v1/farm/{farmId}/device/{deviceId}/telemetry`), basic payload validation, auto device
  registration, simple threshold alerts (low soil moisture, low battery, device offline), and an
  unauthenticated read-only REST API (`GET /api/v1/open/...`) for the demo dashboard.
- `device/simulator`: standalone Node MQTT publisher — soil moisture, temperature, humidity,
  battery, and online status every 5 seconds, zero hardware required.
- `apps/dashboard`: static, build-free HTML/CSS/JS dashboard showing farm → field → device,
  latest telemetry, online/offline status, and open alerts.
- `docker-compose.yml`: one-command local stack (MySQL, Mosquitto, backend, simulator, dashboard).
- `docs/AUDIT.md`, `docs/architecture.md`, `docs/mqtt-spec.md`: what already existed, what's new,
  and why, plus the full MQTT contract.
- Open-source project files: this file, `LICENSE` (Apache-2.0), `CONTRIBUTING.md`, `ROADMAP.md`.

### Known deviations from a from-scratch design (see `docs/AUDIT.md` for full reasoning)

- Uses MySQL, not PostgreSQL — the existing schema, ~30 migrations, and seed tooling are all
  MySQL; introducing Postgres would have meant rewriting a large amount of already-working code.
- `docker-compose.yml`'s backend service applies the schema with `prisma db push`, not
  `prisma migrate deploy` — a pre-existing gap in the migration history
  (`20260629000300_p3_traceability`) prevents a fresh database from completing the full migration
  chain. `db push` builds directly from `prisma/schema.prisma` and sidesteps it without touching
  the migration files. Verified against a real, empty MySQL 8.4 container.

### Explicitly not included

AI/LLM decision-making, automatic irrigation or valve/pump control, ESP32/LoRa firmware, mobile
app changes, multi-tenancy or complex authentication on the new demo endpoints. See `ROADMAP.md`.
