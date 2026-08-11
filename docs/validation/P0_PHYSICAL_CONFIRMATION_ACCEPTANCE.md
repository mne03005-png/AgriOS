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

An execution claimed as `DISPATCHING` but interrupted by restart becomes `OUTCOME_UNKNOWN`. It is not blindly resent. Reconciliation must use confirmed physical state. This closes false-success semantics while intentionally leaving real-device proof for controlled commissioning.

The Edge Runtime E2E initially reproduced the known observation-window flake (`EDGE_SENDING_STATE_TIMEOUT`). The test now provides a deterministic persisted-SENDING window, a bounded 30-second startup/fsync allowance, immediate child-exit diagnostics, and guaranteed child cleanup. The corrected suite passed 3/3 consecutive runs; no retry-until-green logic was added.

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
- REAL hardware used: 0
- REAL Modbus write: 0
