# P0 Auth and Control Entry Acceptance

## Result

- AUTH COVERAGE = PASS (Batch 1 control and platform entry points)
- TENANT ISOLATION = PASS
- APPROVAL ISOLATION = PASS
- ACTION PLAN AUTH = PASS
- FORCE SAFETY BYPASS CLOSED = PASS
- FORGED JWT CONTEXT = BLOCKED / PASS
- X-TENANT-ID NORMAL USER SWITCH = BLOCKED / PASS
- REAL HARDWARE USED = NO
- REAL MODBUS WRITE = NO

The 37-case focused suite exercises guard metadata, the actual JWT, tenant and permission guards, service-layer tenant queries, execution authorization, safety behavior, and operation-log metadata. An invalidly signed JWT-like value cannot populate `RequestContext`; trusted identity is copied only from the database-backed principal after `JwtService.verify()` succeeds.

## Batch 1 controller disposition

| Controller | Final protection |
| --- | --- |
| TenantController | JWT + tenant guard + `tenant.manage` + `platform.context`; service also requires platform identity |
| ApprovalController | Existing JWT + tenant + approval permissions; service lookup now tenant-scoped |
| ApprovalsAliasController | Retained for compatibility; now equivalent JWT + tenant + approval permission protection |
| DecisionEngineController | JWT + tenant + route-specific read/execute/edge permissions |
| ExecutionController | JWT + tenant + `action.execute` |
| DecisionController | JWT + tenant + `action.execute` |
| MqttController | JWT + tenant + `device.manage`; direct transport authorization remains enforced by MqttService |
| DeviceController | JWT + tenant + `device.manage`, including inherited mutations and command route |
| DeviceCommandController | JWT + tenant + `device.read` |
| ActionQueueController | Existing JWT + tenant + action execute/cancel permissions |
| DeviceControlController | Existing JWT + tenant + route permissions/reauth; machine feedback keeps its dedicated signed path |
| SafetyController | Existing JWT + tenant + safety/emergency permissions |
| Audit, Billing, Bluetooth, DroneReview, EdgeGateway, Installer, Mobile | Existing JWT + tenant + domain permissions |
| Farm, Field | Existing JWT + tenant protection |
| AuthController | PUBLIC BY DESIGN only for login/refresh; authenticated account routes already use JWT guard |
| HealthController | PUBLIC BY DESIGN for liveness/readiness |
| DemoController | PUBLIC BY DESIGN legacy demo surface; must remain non-production/demo-data-only |
| AI recommendation mixed routes and IoT callback routes | Existing mixed user guards and dedicated ingestion semantics; not changed in Batch 1 |
| AI Decision, Cost, Crop Health/Recipe/Season, Dashboard, Digital Twin, Drone Operation, Event Bus, Farm Activity/Input, Fertigation, GIS, Irrigation family, IoT Integration, Operation Cost/Log/Report, Report, Sensor Record, Service Provider, User, Wetting Simulation, Work Log, Yield Analysis | MUST BE GUARDED under a later default-deny/RBAC closure; audited and not physical-control entry points changed by this batch |

The repository has 56 module controllers. A global default-deny guard is recommended as a later bounded migration after public and machine callback routes have explicit metadata; this batch intentionally avoids that broad auth-model refactor.

## Safety override contract

`force` is no longer part of the DTO or service API. `AUTHORIZED_POLICY_OVERRIDE` is explicit, requires the distinct `action.policy.override` permission and a nonblank reason, and writes user, tenant, plan, reason, request ID, type and timestamp into the existing operation log. All current safety `blocks` are hard and cannot be overridden. Warnings are soft policy conditions. `EMERGENCY_STOP_ENABLED` remains a hard block and produces zero device-control calls.

## Scope guarantees

No six-gate PLC setting or real mapping changed. No Docker, production service, production MQTT/Redis/database, PLC, real hardware, or real Modbus write was used.
