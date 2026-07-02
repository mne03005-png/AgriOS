# AgriOS P11.6.1 Drone Review Smoke Test

## Purpose

This smoke test verifies the P11.6 data link:

```text
DroneImportJob -> DroneOperation -> DroneOperationReview -> FieldBoundary link -> Spatial stats -> OperationReport -> OperationCost -> CropHealthObservation -> YieldFactor -> Mobile Reports
```

P11.6.1 does not control drones, pumps or valves. It only verifies data import, review and reporting records.

## Prerequisites

Run the database migration and backend:

```bash
cd apps/backend
npx prisma migrate dev
npx prisma generate
npm run start:dev
```

Sample drone files:

- `samples/drone/onion-field-a.kml`
- `samples/drone/onion-spray-route.geojson`
- `samples/drone/onion-spray-route.csv`

Default smoke variables:

```text
farmId= farm_001
fieldId= field_001
```

Replace these IDs with real seed IDs if your local database uses different values.

## 1. Import Drone Operation File

```powershell
curl.exe -X POST http://localhost:3000/api/v1/drone-operations/import-file `
  -F "farmId=farm_001" `
  -F "fieldId=field_001" `
  -F "source=DJI_SMARTFARM" `
  -F "operationType=SPRAYING" `
  -F "droneModel=DJI Agras T50" `
  -F "chemicalName=onion foliar fertilizer" `
  -F "sprayVolumeL=92" `
  -F "file=@samples/drone/onion-field-a.kml"
```

Expected:

- `DroneImportJob.status = PARSED`
- `DroneOperation` created
- `MapLayer` created for route and coverage
- `DroneOperationReview` created

## 2. View Import Result

```powershell
curl.exe "http://localhost:3000/api/v1/drone-operations?farmId=farm_001"
```

Copy the imported operation ID and use it as `operationId` in the next steps.

## 3. View Review List

```powershell
curl.exe "http://localhost:3000/api/v1/drone-operations/reviews?farmId=farm_001"
```

Expected review status:

- `PENDING`, or
- `NEEDS_MANUAL_LINK`, or
- `NEEDS_BOUNDARY_FIX`

## 4. Manually Link Field

```powershell
curl.exe -X POST "http://localhost:3000/api/v1/drone-operations/{operationId}/review/link-field" `
  -H "Content-Type: application/json" `
  -d "{\"fieldId\":\"field_001\",\"reviewNote\":\"manual smoke link\"}"
```

Expected:

- `DroneOperation.fieldId` updated
- spatial stats recalculated
- event `drone.review.field.linked` written

## 5. Approve Review

```powershell
curl.exe -X POST "http://localhost:3000/api/v1/drone-operations/{operationId}/review/approve" `
  -H "Content-Type: application/json" `
  -d "{\"reviewNote\":\"smoke approved\"}"
```

Expected:

- `DroneOperation.status = REVIEWED`
- `DroneOperationReview.status = APPROVED`
- `OperationCost` placeholders created
- `YieldFactor` created
- `FarmActivity: DRONE_OPERATION_REVIEWED` created

## 6. Generate Report

```powershell
curl.exe -X POST "http://localhost:3000/api/v1/drone-operations/{operationId}/generate-report"
```

Expected:

- `OperationReport` created
- `operationCostSummary` included in report summary

## 7. View Operation Costs

```powershell
curl.exe "http://localhost:3000/api/v1/operation-costs?farmId=farm_001"
```

Expected categories:

- `PESTICIDE`
- `DRONE_SERVICE`

Amounts may be `0` because P11.6 uses cost placeholders for later manual completion.

## 8. View Crop Health Observations

```powershell
curl.exe "http://localhost:3000/api/v1/crop-health/observations?farmId=farm_001"
```

For `SCOUTING` or `MAPPING` imports, this should include a placeholder observation. For `SPRAYING`, this may be empty.

## 9. View Yield Factors

```powershell
curl.exe "http://localhost:3000/api/v1/yield-analysis/factors?farmId=farm_001"
```

Expected:

- `DRONE_SPRAYING` for spraying operations
- `DRONE_SCOUTING` for scouting or mapping operations

## 10. View Mobile Report Summary

```powershell
curl.exe "http://localhost:3000/api/v1/mobile/reports/summary?farmId=farm_001"
```

Expected:

- `operationCostSummary`
- `pesticideUsageSummary`
- `droneServiceCostSummary`
- `cropHealthSummary`
- `yieldAnalysisSummary`

## Script

PowerShell helper:

```text
apps/backend/scripts/p11_6_smoke_test.ps1
```

The script uses:

```powershell
$farmId = "farm_001"
$fieldId = "field_001"
$operationId = "replace_me"
```

Run the import first, copy the returned operation ID, replace `$operationId`, then rerun the review/report steps.

## Current Limits

- No drone control
- No automatic pump or valve execution
- No real DJI SDK
- No DJI private FlightRecord parsing
- No real crop disease AI recognition
- No real yield prediction
