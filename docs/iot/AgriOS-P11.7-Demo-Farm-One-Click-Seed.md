# AgriOS P11.7 Demo Farm One-Click Seed

## Goal

P11.7 provides a one-click demo baseline for real product demonstrations. It initializes a full smart onion farm dataset without changing ThingsBoard/Webhook ingestion, without controlling drones, and without automatic pump or valve execution.

Demo farm ID:

```text
demo
```

Verify mobile APIs with:

```text
/api/v1/mobile/cockpit?farmId=demo
/api/v1/mobile/map?farmId=demo
/api/v1/mobile/reports/summary?farmId=demo
```

## Run

From backend:

```bash
cd apps/backend
npx prisma migrate dev
npx prisma generate
npx prisma db seed
```

Or run only the demo farm seed:

```bash
cd apps/backend
npx ts-node prisma/seed-demo-farm.ts
```

The seed is repeatable. It uses fixed demo IDs and `upsert`, so rerunning it updates the demo baseline instead of duplicating records.

## Demo Data

### Tenant And Farm

- Tenant: `AgriOS Demo Tenant`
- Farm: `洋葱智慧农场 Demo`
- Farm ID: `demo`

### Fields

- `洋葱A区`
- `洋葱B区`
- `玉米试验区`

### GIS

- `FieldBoundary` for `洋葱A区`
- `MapLayer` of type `FIELD`
- Drone route and coverage layers

The demo boundary uses an embedded polygon aligned with:

- `samples/drone/onion-field-a.kml`
- `samples/drone/onion-spray-route.geojson`
- `samples/drone/onion-spray-route.csv`

### Devices

- 土壤湿度传感器
- 压力传感器
- 流量计
- 电动阀
- 水泵
- 施肥机
- 肥料罐
- 网关

### Telemetry

Creates `DeviceTelemetrySnapshot` values:

- `pressureKpa`
- `flowRateM3h`
- `valveOpeningPercent`
- `pumpFrequencyHz`
- `fertilizerTankLevelL`
- `batteryPercent`
- `signalStrength`

Creates 24 hours of demo `SensorRecord` soil moisture data.

### Irrigation Engineering

Creates:

- `IrrigationDesign`
- `IrrigationDesignZone`
- `IrrigationBOM`
- `IrrigationBOMItem`
- `HydraulicCheckResult`
- `CropIrrigationRecipe`
- `WettingSimulation`
- `IrrigationRotationGroup`
- `IrrigationRotationValve`
- `IrrigationRotationSchedule`
- `IrrigationRotationRun`

### Fertigation

Creates:

- `FertilizerTank`
- `FertigationRecipe`
- `FertigationTask`

### Drone Operation

Creates:

- `DroneImportJob`
- `DroneOperation`
- `DroneOperationReview`
- `MapLayer` for route and coverage
- `OperationReport`

The demo drone operation is marked as reviewed and safe for report demonstrations.

### Business Records

Creates:

- `OperationCost`: pesticide, fertilizer, drone service, labor
- `CropHealthObservation`: scouting, pest, water stress examples
- `YieldFactor`: irrigation, fertigation, drone spraying, pest/disease
- `YieldRecord`
- `FarmActivity` timeline items

## Mobile Verification

Start backend and mobile, then visit:

- `/cockpit`: use API data from `farmId=demo`
- `/map`: field boundary, drone route and coverage layers
- `/drone-operations`: demo drone operation and upload panel
- `/drone-reviews`: review baseline
- `/reports`: operation cost, pesticide usage, drone service cost, crop health, yield factors

## Current Limits

- No drone control
- No automatic pump or valve execution
- No ThingsBoard/Webhook flow changes
- No real DJI SDK
- No real crop disease AI recognition
- No real yield prediction
