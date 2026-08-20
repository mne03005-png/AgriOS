# Contributing to OpenAgriOS

Thanks for considering it. This project is a genuinely large, mostly-already-built platform being
opened up in stages, starting with a small public alpha — read [`docs/AUDIT.md`](docs/AUDIT.md)
first so you know what already exists before proposing something that might duplicate it.

## Before you start

1. Read [`docs/architecture.md`](docs/architecture.md) and [`docs/mqtt-spec.md`](docs/mqtt-spec.md)
   for the v0.1-alpha demo pipeline this repository currently ships.
2. Check [`ROADMAP.md`](ROADMAP.md) — if what you want to build is a later phase (hardware
   firmware, edge agent, AI assistant, automatic control), open an issue to discuss sequencing
   before writing code. Phase 5 (automatic control loops) in particular requires a safety review;
   see below.
3. Run the alpha demo locally (`docker compose up`) before changing it, so you have a baseline to
   compare against.

## Different parts of this repo need different care

- **`apps/backend`** — NestJS/Prisma/MySQL. This is the largest, most mature part of the codebase.
  Small, well-scoped PRs against a single module are much easier to review than cross-cutting
  changes. Do not modify `SafetyModule`, `DeviceControlModule`, `ActionQueueModule`, or any
  real-write gate (`ENABLE_AUTO_EXECUTION`, `DEVICE_CONTROL_MODE`, `PLC_REAL_WRITE_ENABLED`, etc.)
  without an explicit safety review — see below.
- **`device/simulator`** — plain Node, no framework. Good first-contribution target if you want to
  add more simulated scenarios (e.g. sensor drift, packet loss) without touching the backend.
- **`apps/dashboard`** — static HTML/CSS/JS, no build step, on purpose. If a change needs a build
  step or a framework, it's probably out of scope for this alpha dashboard — open an issue first.
- **`firmware/` and `hardware/`** — not created yet (Phase 2). If you want to start this work
  early, open an issue; real sensor hardware changes need review from someone who can validate
  them against actual devices, not just code review.

## Reporting a safety-relevant issue

If you find a way to make the platform open a valve, start a pump, or otherwise actuate hardware
without going through the existing safety/approval/physical-confirmation chain, **do not open a
public issue**. Email the maintainers privately first (see repository settings for current
contact) so a fix can ship before the gap is public. Everything else — including bugs in this
alpha's telemetry/dashboard path, which has no control surface at all — is fine as a normal public
issue.

## Pull requests

- Keep PRs scoped to one logical change; explain *why*, not just *what*, in the description.
- Add or update a test where the change is testable (this backend already has an extensive
  `scripts/verify-*.ts` pattern per module — follow it for backend changes).
- If your change touches anything in the "what is explicitly not touched" list in
  [`docs/AUDIT.md`](docs/AUDIT.md), say so explicitly in the PR description and why it was
  necessary.

## Commit style

This project uses Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, …). Keep the subject
line under ~72 characters; use the body to explain reasoning, not to restate the diff.
