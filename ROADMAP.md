# OpenAgriOS Roadmap

## Now — v0.1-alpha (this release)

Sensor Simulator → MQTT → Backend → Database → Dashboard, running with zero physical hardware.
Farm/Field/Device/Telemetry/Alert entities, a versioned MQTT topic contract, a public read API,
and a Docker Compose stack a stranger can run with one command. See
[`docs/architecture.md`](docs/architecture.md) for what's actually implemented and
[`docs/AUDIT.md`](docs/AUDIT.md) for what already existed versus what's new here.

Explicitly **not** in this release (see `docs/AUDIT.md` for why each is deferred, not just
omitted): AI/LLM decision-making, automatic irrigation or valve/pump control, ESP32/LoRa firmware,
mobile app changes, multi-tenancy or complex auth on the new public demo endpoints.

## Phase 2 — Real hardware integration

- ESP32 (or comparable low-power MCU) firmware for real soil-moisture/temperature/humidity/battery
  sensing, replacing `device/simulator` with real nodes.
- LoRa sensor nodes: a gateway that decodes LoRa packets and republishes them on the exact same
  `agrios/v1/farm/{farmId}/device/{deviceId}/telemetry` contract this alpha already ingests — the
  backend does not need to change for this.
- Real hardware validation at the 300&nbsp;mu Jingshan pilot: LoRa coverage, solar/battery sizing,
  waterproofing, per-device MQTT credentials/ACLs (the alpha's `allow_anonymous true` broker config
  is local-demo-only).

## Phase 3 — Edge agent, offline operation, gateway support

- A field-side gateway process that buffers telemetry through backhaul outages and can hold basic
  safety interlocks locally even when cloud connectivity drops.
- Store-and-forward reliability, reconnect handling, and the idempotency envelope
  (`messageId`/`sequence`) sketched in `docs/architecture/AgriOS-MVP-Implementation-Plan.md` but
  not implemented in v0.1-alpha.

## Phase 4 — AI agriculture assistant

- Prediction and decision support built on top of the existing (already-implemented, currently
  internal) `AiDecisionModule`/`AiRecommendationModule` and real accumulated telemetry history —
  advisory only, human-approved, matching the platform's existing safety posture.

## Phase 5 — Verified automatic control loop, smart irrigation

- Automatic valve/pump execution, gated behind the platform's existing safety chain (hard-block
  checks, priority arbitration, physical confirmation before a command counts as successful — all
  already implemented for authenticated production use; see `docs/DEVELOPMENT_LOG.md`).
- This phase requires an explicit safety review before merge, not just code review. See
  [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Also on the horizon (not sequenced yet)

Smart beekeeping and drone agriculture integration, per the original OpenAgriOS positioning
discussion — the platform's `DroneOperation` model and drone import pipeline already exist
internally (see `docs/DEVELOPMENT_LOG.md`, P11.3–P11.6) and would extend rather than replace this
roadmap once Phase 2/3 hardware work lands.
