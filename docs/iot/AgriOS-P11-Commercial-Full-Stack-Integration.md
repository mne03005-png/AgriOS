# AgriOS P11 Commercial Full Stack Integration

P11 turns AgriOS into a commercial-ready backend foundation for agricultural SaaS, IoT control, GIS boundary management, irrigation engineering, safe execution, billing and mobile cockpit APIs.

## Module List

- tenant
- gis
- irrigation-design
- crop-recipe
- wetting-simulation
- safety
- action-queue
- device-control
- event-bus
- mobile
- billing
- ai-recommendation

## Data Link Overview

```text
Sensor Data -> Field State -> Decision -> Engineering Preview -> Safety -> Queue -> Device -> Feedback -> Audit -> Mobile
```

## GIS And Decision Engine

GIS data defines field boundaries, map layers, GPS tracks and drone job foundations. Approved `FieldBoundary` records create `MapLayer` records. These boundaries prepare future field-specific irrigation zones and route planning.

## IrrigationDesign And ActionPlan

`IrrigationDesign` stores crop, soil, emitter, pipe and pressure data. `ActionPlannerService` uses the latest design to enrich ActionPlan safety payload and estimate irrigation effect.

## CropRecipe And StrategyEngine

`CropIrrigationRecipe` replaces fixed thresholds when available. If no recipe matches, the old rule-based fallback remains.

## WettingSimulation And Safety

Wetting simulation estimates deep percolation risk. High risk blocks or requires approval before execution.

## Safety / Approval / Queue / DeviceControl

Execution flow:

```text
ActionPlan
 -> SafetyService.checkActionPlan
 -> ApprovalRequest if needed
 -> ActionQueueJob
 -> ActionExecutor
 -> DeviceControlService
 -> MQTT / mock / ThingsBoard adapter
```

## Billing And UsageRecord

Billing records can be created for:

- `AI_DECISION`
- `IRRIGATION_ACTION`
- `MAP_RECOGNITION`
- `DRONE_JOB`
- `DEVICE_ONLINE`
- `WATER_USAGE`

Payment integration is intentionally not implemented.

## Mobile API

`mobile` exposes cockpit, map, field detail, AI recommendations, operations, alerts, controls and reports summary for a future Tesla-like farm cockpit app.

## Not Implemented Yet

- Real frontend UI.
- Real LLM integration.
- Real drone SDK integration.
- Default automatic pump or valve opening.
- Copying ThingsBoard source code.
