# AgriOS P11.4 Execution Result and Mobile Operational UI

P11.4 connects execution results back to business records, adds default demo templates, and enhances the mobile operational UI for real field workflows.

## Goals

- Write ActionExecution and ActionQueueJob results back to rotation, fertigation, dissolve fertilizer tasks, reports, activities, and usage records.
- Initialize demo baseline templates for anomaly rules, safety policy, irrigation products, crop recipes, and fertigation recipes.
- Improve mobile Cockpit, Operations, Alerts, Reports, Map, and Drone Operations views.

## Execution Result Linkback

`ExecutionResultLinkerService` is called after action plan execution and queue failure.

```text
ActionExecution / ActionQueueJob
  -> ExecutionResultLinkerService
  -> IrrigationRotationRun / FertigationTask / DissolveFertilizerTask
  -> OperationReport
  -> FarmActivity
  -> UsageRecord
  -> EventLog
```

## Rotation Run Linkback

For `IrrigationRotationRun`, the linker writes:

- status: SUCCESS / FAILED / CANCELLED
- totalValves
- successValves
- failedValves
- durationMinutes
- pressureSummary
- flowSummary

It also updates or creates a `ROTATION` operation report and a `ROTATION_COMPLETED` farm activity.

## Fertigation Linkback

For `FertigationTask`, the linker writes:

- status: SUCCESS / FAILED / CANCELLED
- durationMinutes
- targetWaterVolume
- targetFertilizerVolume
- tankBeforeLevel
- tankAfterLevel
- anomalies

When execution succeeds and a fertilizer tank is linked, the demo implementation deducts target fertilizer volume from the tank level.

## Default Templates Seed

`apps/backend/prisma/seed-default-templates.ts` initializes demo baseline data. These values are not agronomic standards; they must be calibrated by field technicians or agronomists before production use.

Seeded anomaly rules:

- pressure drop
- pressure too high
- flow too low
- flow too high
- valve not responding
- pump abnormal
- fertilizer tank low level

Seeded safety policy:

- allowAutoExecution = false
- maxIrrigationMinutesPerAction = 120
- maxDailyIrrigationMinutesPerField = 360
- emergencyStopEnabled = false
- requireApprovalRiskLevel = MEDIUM

Seeded product and recipe templates:

- irrigation products: dripline, valve, filter, pipe, connector, sensor, controller, fertigation
- crop irrigation demo baselines: onion, soybean, corn, grape across sandy, loam, clay
- fertigation recipes: seedling, vegetative growth, bulking stage

## Mobile Cockpit Cards

New cards:

- PressureFlowSummaryCard
- PumpStatusCard
- FertigationStatusCard
- FarmActivityTimeline

## Mobile Operations Groups

Operations now groups:

- action plans
- rotation runs
- fertigation tasks
- dissolve fertilizer tasks
- pump operations
- drone mapping
- drone spraying
- drone spreading
- drone scouting

## DroneOperationsPage

The new mobile page `/drone-operations` shows:

- mapping operations
- spraying operations
- spreading operations
- scouting operations
- coverage summary
- JSON payload import panel

The import panel calls `POST /api/v1/drone-operations/import` and does not perform real file upload in P11.4.

## Safety Boundaries

- P11.4 does not enable default automatic pump or valve execution.
- Backend Safety, Approval, ActionQueue, and DeviceControl remain final control points.
- DJI integration remains data import only; AgriOS does not control drones.

## Future Work

- Replace in-memory queue with Redis/BullMQ.
- Add real multipart KML/KMZ upload.
- Add complex polygon intersection.
- Add GeoTIFF raster analysis.
- Add stronger execution-result idempotency and audit replay.
