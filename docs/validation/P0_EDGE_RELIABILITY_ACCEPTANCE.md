# P0 Edge Reliability Acceptance

## Result

- EDGE PERSISTENT CACHE = YES
- OFFLINE REPLAY = YES
- COMMAND DEDUP = YES
- ACK PERSISTENCE = YES
- RESTART RECOVERY = YES
- REAL HARDWARE USED = NO
- REAL HARDWARE ENABLED = NO

## Existing capability audit

| Capability | Before P0 Edge Reliability | Reused or completed here |
| --- | --- | --- |
| Edge gateway inventory/binding/commands | Implemented as cloud CRUD | Reused; no duplicate registry model |
| Edge HTTP controller | Adapter/interface only | Retained as a control adapter |
| Edge controller | Simulator only | Not treated as a production agent |
| MQTT | Cloud client and local simulators; reconnect delegated to library defaults | Edge retry policy now defines bounded exponential backoff and jitter |
| Telemetry persistence | Cloud `SensorRecord` and latest snapshot | `SensorRecord.eventId` unique key now provides messageId-based idempotency |
| Command identity | `DeviceCommand.requestId` and `EdgeCommand.requestId` unique | Edge command receipt/execution state is also persisted locally |
| Offline telemetry/ACK queue | Documentation only | Implemented as an atomic persistent local store |
| Store-and-forward/restart recovery | Documentation only | Implemented and automatically tested |

## Architecture and persistence

`EdgeReliabilityAgent` accepts scoped sensor/PLC events, writes them to `PersistentEdgeStore`, and only then attempts cloud delivery. The store is an embedded atomic JSON snapshot: it writes a mode-0600 temporary file and renames it over the active file. This avoids a new native database dependency while providing process/power-loss persistence for the bounded P0 queue. It is not an in-memory array-only design.

Stored telemetry includes stable `messageId`, device/tenant/farm identity, original device time, Edge receive time, sequence, payload, attempts, last attempt and lifecycle status. Commands and ACKs have separate persistent records. Entries left in `SENDING` during termination recover as `PENDING` on restart.

Capacity is bounded by queue count, storage bytes and retention. Ordinary telemetry is rejected explicitly when full. CRITICAL/CONTROL/ACK traffic can displace oldest pending telemetry but an unsent ACK is never silently evicted. Health reports queue depth, oldest pending age, upload/command/ACK times, network state, storage usage/state and software version.

## Replay, priority and weak networks

Replay is oldest-first within a class and bounded by `batchSize` (default 50). ACK/CRITICAL/CONTROL traffic is selected before telemetry backlog. A failed upload returns the item to `PENDING` and stops the batch, preventing success assumptions. Reconnect delay uses capped exponential backoff plus jitter; tests compress outage time and introduce deterministic loss without contacting a broker or external network.

## Idempotency, expiry and quality

- Edge telemetry retries keep the original messageId.
- Cloud records derive a deterministic `eventId` from messageId and logical metric and use the existing unique constraint with `skipDuplicates`.
- Sequence metadata marks duplicate, out-of-order and missing-sequence samples without dropping late/out-of-order measurements.
- Invalid/future timestamps and samples older than 24 hours are marked; original device timestamps are retained.
- Command records survive restart. Replayed commandIds return the prior result without calling the physical executor again.
- Expired `PUMP_ON`/`VALVE_OPEN` commands produce an EXPIRED ACK and are not executed. STOP follows the existing safety policy and remains executable.
- ACKs persist locally and replay ahead of ordinary telemetry.

## Security boundary

The agent is configured with explicit tenant, farm and device scope. Cross-tenant, cross-farm and unknown-device inputs fail closed. Command handling requires signature validation before persistence or execution. No user password, SUPER_ADMIN token, raw HMAC key or credential is stored or emitted in evidence; ACKs retain only non-secret signature metadata.

## Automated acceptance

The executable suite covers 32 assertions including online/offline telemetry, 10/100/1000 queue depth, restart persistence, batched replay, restart during replay, cloud dedup, out-of-order and missing sequence, backoff/jitter, persistent command dedup, dangerous-command expiry, STOP policy, ACK persistence/priority, queue full, storage warning, malformed telemetry, scope mismatch, invalid HMAC and clock drift. Deterministic fake-network profiles separately cover compressed 100/500/2000 ms latency and 5/20/50% delivery failure.

Core result:

- telemetry generated: 1000
- telemetry uploaded and uniquely stored: 1000
- lost telemetry: 0
- duplicate business records: 0
- duplicate command physical execution: 0
- lost ACK: 0
- expired dangerous command executed: 0
- unsafe START after reconnect: 0
- STOP priority failures: 0

Evidence is generated under `artifacts/validation/` as JSON and Markdown. Tests use temporary local files and fake transports only. No Docker, Redis, MQTT broker, database, production service or real hardware is used.
