# AgriOS P11 Full Data Link Audit

本文件记录当前 AgriOS 后端从 IoT 遥测、决策、执行、反馈到 P11 GIS/灌溉工程/移动端聚合的完整数据链路。

## Existing Model And Service Check

- `User / Farm / Field`: exists.
- `Device`: exists.
- `SensorRecord`: exists.
- ThingsBoard webhook services: `thingsboard-webhook.service.ts`, `thingsboard-client.service.ts` exist under `modules/iot`.
- DeadLetter services: `iot-webhook-dead-letter.service.ts` exists.
- SyncAudit services: `iot-sync-audit.service.ts` exists.
- `FieldStateSnapshot`: exists.
- `DecisionRecord`: exists.
- `ActionPlan`: exists.
- `ActionExecution`: exists.
- `DeviceCommand / MQTT command service`: `DeviceCommand`, `DeviceService.sendCommand`, `MqttService.publishCommand` exist.
- `iot controller/service`: `iot.controller.ts` and IoT services exist.
- `decision-engine service/controller`: exists.

## IoT To SensorRecord

ThingsBoard sends telemetry to AgriOS webhook endpoints. The webhook service validates secret, maps the incoming device identity, checks deduplication, and writes normalized telemetry into `SensorRecord`. Invalid or unprocessable payloads are stored through DeadLetter.

## SensorRecord To FieldStateSnapshot

The P7 `FieldStateEngineService` reads the latest field telemetry and device status, then creates `FieldStateSnapshot`. It captures soil moisture, temperature, humidity, online/offline device counts, risk level, crop season and a summary payload.

## FieldStateSnapshot To DecisionRecord

`DecisionEngineService.runFieldDecision` calls `StrategyEngineService.evaluate(snapshot)`. P11 now tries `CropIrrigationRecipe` first. If a matching recipe exists, its target moisture range is used. If no recipe exists, the old fallback rule remains: soil moisture below 35 means irrigate, above 60 means stop irrigation.

## DecisionRecord To ActionPlan

`ActionPlannerService.createPlan` converts a decision into planned device actions. For irrigation actions, it also looks for `IrrigationDesign`, `CropIrrigationRecipe`, and `WettingSimulation` preview data, then stores engineering and safety data in `ActionPlan.safety` and action payload.

## ActionPlan To ActionExecution

`ActionExecutorService.executePlan` loads the plan, asks `SafetyService.checkActionPlan` for a final gate, and then creates `ActionExecution` records for executable device commands.

## ActionExecution To DeviceCommand/MQTT

Device execution now goes through `DeviceControlService`. The default MQTT adapter calls the existing `DeviceService.sendCommand`, which creates `DeviceCommand` and publishes through `MqttService`. Mock and ThingsBoard adapters are available as stable extension points.

## Feedback To ActionExecution

Device command ACK messages update `DeviceCommand`. The decision-engine feedback endpoint updates `ActionExecution.feedback`, `feedbackAt`, and status.

## Failure To DeadLetter

Webhook failures continue to use `IoTWebhookDeadLetter`. New Action Queue failures update `ActionQueueJob`; when retries are exhausted the job is marked `DEAD_LETTERED` and emits `deadletter.created` for audit and future DeadLetter integration.

## SyncAudit

Existing IoT sync audit records ThingsBoard sync operations, before/after state and exports. P11 event publishing also writes `EventLog`, giving new modules a lightweight audit trail without changing P6.6 ingestion behavior.

## GIS In Decision Engine

Manual Draw, GPS Track, Drone Flight, and GeoJSON are normalized through `CoordinateTransformService` and stored as `FieldBoundary`. Approved boundaries create `MapLayer`. Irrigation designs can reference field/boundary context and later guide ActionPlan generation.

## IrrigationDesign In Decision Engine

`IrrigationDesign` supplies engineering parameters such as emitter flow, spacing, zones and pressure targets. BOM generation and hydraulic checks produce `IrrigationBOM` and `HydraulicCheckResult`.

## CropRecipe In StrategyEngine

`CropIrrigationRecipe` provides crop-stage-specific target moisture ranges. It overrides the fixed 35/60 thresholds when matched.

## WettingSimulation In ActionPlan

`WettingSimulationService.preview` estimates surface wetting, root-zone wetting, expected moisture increase, recommended duration and deep percolation risk. High deep percolation risk blocks automatic execution.

## Final P11 Link

```text
ThingsBoard/Webhook
 -> SensorRecord
 -> FieldStateSnapshot
 -> CropIrrigationRecipe
 -> DecisionRecord
 -> IrrigationDesign / HydraulicCheckResult
 -> WettingSimulation
 -> ActionPlan
 -> SafetyPolicy / AutoExecutionPolicy
 -> ApprovalRequest
 -> ActionQueueJob
 -> ActionExecution
 -> DeviceControlService
 -> DeviceCommand/MQTT
 -> Feedback
 -> EventLog / SyncAudit
 -> UsageRecord
 -> Mobile Cockpit API
```
