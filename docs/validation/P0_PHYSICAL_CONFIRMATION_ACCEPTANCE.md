# P0 Physical Confirmation Acceptance

## Software acceptance

- TRANSPORT != PHYSICAL SUCCESS = PASS
- PLC READ STATUS ABSTRACTION = PASS
- FEEDBACK PROFILE GATE = PASS
- STATUS FRESHNESS = PASS
- VALVE CONFIRMATION BEFORE PUMP = PASS
- PUMP STOP CONFIRMATION BEFORE VALVE CLOSE = PASS
- FEEDBACK TIMEOUT = PASS
- FEEDBACK MISMATCH = PASS
- FEEDBACK IDENTITY = PASS
- MYSQL MIGRATION DEPLOY (EXISTING BASELINE) = PASS
- MYSQL PROVIDER COMPATIBILITY = PASS
- INDEPENDENT FEEDBACK MAPPING = PASS
- WRITE OUTPUT CANNOT SELF-CONFIRM = PASS
- HUMAN JWT PHYSICAL CONFIRMATION = BLOCKED / PASS
- INSTALLER EDGE_MANAGE PHYSICAL CONFIRMATION = BLOCKED / PASS
- TRUSTED PHYSICAL EVIDENCE PROVENANCE = PASS
- TRUSTED EDGE FEEDBACK INGESTION = NOT_YET_IMPLEMENTED
- BUSINESS COMPLETION ONLY AFTER PHYSICAL CONFIRMATION = PASS
- DISPATCH CRASH CONSISTENCY = PASS
- UNKNOWN OUTCOME NO BLIND RETRY = PASS
- REAL HARDWARE USED = NO
- REAL MODBUS WRITE = NO
- REAL PHYSICAL FEEDBACK VERIFIED = NO
- Software fake/local physical-feedback loop proven = YES

## Command and feedback semantics

The persisted lifecycle is `PENDING -> DISPATCHING -> FEEDBACK_PENDING -> PHYSICALLY_CONFIRMED`. Explicit fail-closed outcomes are `FAILED`, `FEEDBACK_MISMATCH`, `FEEDBACK_TIMEOUT`, `FEEDBACK_UNAVAILABLE`, and `OUTCOME_UNKNOWN`. `SENT`, protocol ACK, MQTT publish, Edge ACK and a successful Modbus write are transport/software evidence only and cannot complete an ActionPlan or business operation.

The Modbus controller reads semantic feedback only through a validated PLC profile. Approved real profiles require confirmed mapping metadata; tests use an explicit `testOnly` profile and localhost/fake transport addresses. No Siemens LOGO address is inferred or claimed. Read-only status remains available with `PLC_REAL_WRITE_ENABLED=false`.

Backend and standalone Edge Runtime both reject REAL completion claims based only on a write return. The Edge REAL path reads the same approved profile semantics, enforces valve/pump interlocks, polls bounded physical feedback, and emits `PHYSICALLY_CONFIRMED` only for matching state. Edge FAKE results carry `feedback.fake=true`.

Status evidence carries `observedAt`, `source`, and freshness. Pump start fails closed unless controller, E-stop, no-water, overload and valve-open state are freshly readable. Valve close remains blocked until fresh pump-stopped feedback. Polling has a bounded interval and timeout and leaves no background timer.

## Business and recovery semantics

ActionExecution, ActionPlan, ActionQueueJob and DecisionRecord remain awaiting confirmation until every required physical action is confirmed. The result linker creates final reports, usage, completion activity and fertilizer inventory effects only after physical confirmation. Completion effects are idempotent. Late feedback is audited without resurrecting a timeout or resending a command.

An execution claimed as `DISPATCHING` but interrupted by restart becomes `OUTCOME_UNKNOWN`. It is not blindly resent or automatically reconciled. A future reconciliation path may act only on separately trusted physical evidence; no such automatic path is claimed by this batch. This closes false-success semantics while intentionally leaving trusted Edge ingestion and real-device proof for later controlled work.

## Trust boundary

The authenticated human feedback endpoint is diagnostic-only. Even an Installer with `EDGE_MANAGE` cannot create `PHYSICALLY_CONFIRMED`. Authoritative completion accepts only a `TrustedPhysicalEvidence` value constructed from validated PLC readback, with matching tenant, farm, device and command identity. A source string supplied by a caller is not trusted provenance. There is currently no authenticated machine-to-machine Edge feedback ingestion route, so `TRUSTED EDGE FEEDBACK INGESTION = NOT_YET_IMPLEMENTED`.

Feedback mappings are resolved by canonical `logicalName` only. A write mapping's `feedbackPoint` must reference a distinct, confirmed, read-capable mapping with the expected feedback semantic. The output mapping itself can never satisfy its own physical confirmation.

## MySQL migration validation

The physical-confirmation migration uses MySQL `ALTER TABLE ... MODIFY ... ENUM(...)` syntax and preserves every pre-existing enum member while adding the new states. On an isolated MySQL 8.4.9 database representing an existing AgriOS baseline, Prisma `migrate deploy` applied the migration and the semantic smoke test inserted every required value across all five enum columns (`5/5 PASS`).

The repository's historical migration chain is not a clean-database bootstrap: its earliest migration references `Field`, `Device` and `CropSeason` tables that it does not create. A clean empty-database replay therefore fails before reaching this migration (`P3018`, MySQL 1824). This pre-existing migration-baseline issue is explicitly not reported as fixed by Batch 3.1.

The Edge Runtime E2E exposed Windows target-file locks while observing persisted `SENDING` state. Persistent atomic replacement now retries only transient Windows `EACCES`/`EBUSY`/`EPERM` errors for a bounded two-second window and otherwise fails. The observer polls every 50 ms (still bounded to 30 seconds) so it does not starve the writer. After this correction, a fresh suite passed 3/3 consecutive runs; failed attempts were not counted as acceptance runs.

## Metrics

- transport-only business success: 0
- false physical confirmation: 0
- dependent pump start before valve confirmation: 0
- valve close before pump-stop confirmation: 0
- invalid feedback accepted: 0
- duplicate business completion: 0
- duplicate inventory decrement: 0
- blind dangerous retry after unknown outcome: 0
- feedback timeout falsely completed: 0
- lost confirmed feedback: 0
- independent feedback mapping cases: PASS
- human/JWT forged physical confirmations accepted: 0
- trusted evidence identity/provenance violations accepted: 0
- MySQL physical-confirmation enum columns verified: 5 / 5
- REAL hardware used: 0
- REAL Modbus write: 0
