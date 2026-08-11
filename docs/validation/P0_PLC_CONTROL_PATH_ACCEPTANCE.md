# P0 PLC / UC300 control-path acceptance

Date: 2026-08-10

## Result

- Implemented a formal PLC controller contract: `execute`, `emergencyStop`, `readStatus`, `verifyFeedback`, and `healthCheck`.
- Defined one command identity from ActionPlan/ActionQueue through DeviceControl and the PLC adapter. The idempotency key is the command ID.
- Direct Device API, DeviceControl API, MQTT API, irrigation, advice, IoT integration, and legacy MQTT adapter calls cannot publish physical commands without ActionQueue authorization.
- The executable chain is Safety check → approved/policy-eligible ActionPlan → ActionQueue → ActionExecutor → DeviceControlService → selected adapter.
- Command and feedback identity includes tenant, farm, device, timestamps, expiry, parameters, and the same command ID.
- The original state vocabulary covered transport and software acknowledgement. Batch 3 adds `FEEDBACK_PENDING`, `PHYSICALLY_CONFIRMED`, `FEEDBACK_MISMATCH`, `FEEDBACK_TIMEOUT`, `FEEDBACK_UNAVAILABLE`, and `OUTCOME_UNKNOWN`; only `PHYSICALLY_CONFIRMED` represents physical completion.

## Safety and interlocks

- Default control remains MOCK/read-only. REAL execution requires all four independent gates: PLC_GATEWAY mode, dry-run false, real valve control true, and auto execution true.
- Expired, duplicate, offline, identity-mismatched, and unconfigured-profile commands fail closed.
- Pump start requires confirmed valve-open status and is blocked by emergency stop or no-water state.
- Valve close is blocked while its pump is running; pump stop must complete first.
- Emergency stop forces the fake test state to pump-off. STOP is tested independently from START and is not blocked by the start interlock.
- PLC/hardwired safety remains the final authority. Software acknowledgement never replaces electrical interlocks.

## UC300 profile

`uc300.example.json` is an explicit unconfigured example. Unit ID and every Modbus/register address are `null`; no address was invented. REAL mode rejects an incomplete profile. A commissioned register map, protocol selection, feedback semantics, scaling, timeout/retry values, and cabinet fail-safe evidence are still required.

## Verification

The local fake-controller suite covers 15 cases: valve open success, timeout, feedback mismatch, pump/valve interlock block and allow, duplicate command, expiry, controller offline, emergency stop, bounded retry, delayed ACK, malformed ACK, invalid HMAC, wrong tenant/farm/device ACK, and STOP priority.

These fake-controller successes demonstrate software state-machine behavior, not real hardware movement. `SUCCEEDED` in the historical fake suite is test-only simulated feedback and must not be interpreted as a real PLC, pump, or valve confirmation.

Existing non-Docker regression suites and dependency audit must pass before commit. Docker, production services, external brokers, databases, and real hardware are not used.

## Hardware status

Real Modbus mapping supplied: **NO**  
Real PLC transport commissioned: **NO**  
Real hardware enabled: **NO**  
Current mode: **MOCK / dry-run by default**
