# P0 Emergency Stop and Priority Acceptance

## Acceptance result

- EMERGENCY STOP LATCH = PASS
- EMERGENCY STOP DISPATCH PATH = PASS
- BACKEND STOP PRIORITY = PASS
- EDGE STOP PRIORITY = PASS
- STALE START BLOCKING = PASS
- RESET DOES NOT AUTO-RESUME = PASS
- DUPLICATE E-STOP EXECUTION = 0 duplicate fake physical executions
- UNSAFE START AFTER E-STOP = 0
- LOST STOP = 0
- LOST E-STOP = 0
- REAL HARDWARE USED = NO
- REAL MODBUS WRITE = NO
- PHYSICAL STOP CONFIRMED = NO

The software safety dispatch path is proven against fake/local components. Physical feedback is not yet proven. `DISPATCHED` means the Emergency Stop command reached the device-control abstraction; it does not mean a pump or valve was physically confirmed stopped.

## Dispatch and latch order

The authenticated, permission-protected Safety or Mobile API validates tenant/farm/field scope, persists the Emergency Stop latch, invalidates stale queued action plans, resolves only scoped PUMP/VALVE targets, records the audit result, and dispatches through `DeviceControlService` to the existing controller abstraction. There is no direct Safety-to-Modbus call and all six real-write gates remain authoritative.

Repeated requests return the existing latch and do not create a physical execution storm. Dispatch, PLC-offline, queue, or target-resolution failure never rolls back the active latch. Reset is explicit, guarded and audited; it does not resume invalidated work.

## Priority and preemption boundary

The shared edge-core priority model is deterministic: `EMERGENCY_STOP`, `SAFETY_STOP`, `NORMAL_CONTROL`, `BACKGROUND`. Backend in-memory queues order by priority and FIFO sequence. BullMQ uses documented lower-number-higher-priority values 1, 10, 100 and 1000. Delayed and retry work retains priority.

Edge MQTT callbacks enter a serialized arbiter. The latch is applied when Emergency Stop is accepted, before queued execution. Dangerous starts (`PUMP_ON`, `VALVE_OPEN`, `IRRIGATION_START`, fertigation/dissolving starts and energizing setpoints) are suppressed while latched or when stale across an E-stop generation. STOP remains executable. The persisted command journal restores the latch after Edge restart.

Software priority cannot interrupt a transport transaction already in its atomic write boundary. It latches immediately, blocks subsequent START work, and makes E-stop the next action at the earliest safe software dispatch boundary. This is not hard real-time preemption.

## Hardware safety boundary

Software Emergency Stop is not a replacement for a hardwired E-stop, safety relay/PLC, contactor safety chain, VFD STO, or qualified electrical protection. This work makes no functional-safety certification claim.
