# AgriOS P11.3 DJI Drone Data Integration

P11.3 adds a backend foundation for importing DJI and common drone-exported operation data into AgriOS. It focuses on file payload import, parsing skeletons, statistics, field matching, map layers, operation reports, and mobile aggregation.

## Why DJI Data Integration

County-level farms and cooperatives often use DJI drones for mapping, spraying, spreading, seeding, and scouting. These operation records need to become farm business records, not isolated files. AgriOS uses this integration to connect drone work with fields, boundaries, map layers, reports, billing usage, and mobile cockpit views.

## Supported Data Sources

- DJI SmartFarm
- DJI Terra
- DJI Pilot / Pilot 2
- DJI remote controller exported records
- KML
- KMZ
- GeoJSON
- GeoTIFF / TIF + TFW metadata
- CSV
- FlightRecord zip skeleton

P11.3 uses JSON payload import first. Multipart upload and real SDK integration are reserved for later stages.

## Data Flow

```text
DJI SmartFarm / DJI Terra / DJI Pilot export
  -> DroneImportJob
  -> DjiImportService parser skeleton
  -> DroneOperation
  -> DroneStatisticsService
  -> DroneFieldMatchingService
  -> MapLayer
  -> OperationReport
  -> FarmActivity
  -> Mobile Cockpit / Map / Operations / Reports
```

## Model Relationships

- `DroneImportJob`: tracks each import attempt, parser status, parsed JSON, and errors.
- `DroneOperation`: stores business operation records: mapping, spraying, spreading, scouting, seeding.
- `FieldBoundary`: used for simplified field matching and coverage comparison.
- `MapLayer`: stores drone route, coverage, orthomosaic placeholder, and prescription layers.
- `DroneMapJob`: remains the existing drone map processing foundation. P11.3 does not replace it.
- `OperationReport`: generated from drone operation metrics.
- `FarmActivity`: records important timeline events such as imported, spraying completed, or mapping completed.

## Statistics

P11.3 calculates:

- actual area from coverage GeoJSON
- flight route length from LineString
- coverage rate against linked FieldBoundary area
- missed area
- overlap rate placeholder
- repeated area placeholder
- spray volume
- dosage per mu

Complex polygon intersection is intentionally left as TODO. Current coverage comparison uses simplified area math.

## API Examples

Import operation:

```bash
curl -X POST http://localhost:3000/api/v1/drone-operations/import \
  -H "Content-Type: application/json" \
  -d "{\"farmId\":\"farm_001\",\"fieldId\":\"field_001\",\"source\":\"DJI_SMARTFARM\",\"fileName\":\"operation.kml\",\"fileType\":\"KML\",\"coordinateSystem\":\"WGS84\",\"operationType\":\"SPRAYING\",\"droneModel\":\"DJI Agras T50\",\"routeGeoJson\":{\"type\":\"LineString\",\"coordinates\":[[118.1,36.7],[118.11,36.71]]},\"sprayVolumeL\":92,\"chemicalName\":\"demo pesticide\"}"
```

List operations:

```bash
curl "http://localhost:3000/api/v1/drone-operations?farmId=farm_001"
```

Link field:

```bash
curl -X POST http://localhost:3000/api/v1/drone-operations/{id}/link-field \
  -H "Content-Type: application/json" \
  -d "{\"fieldId\":\"field_001\",\"fieldBoundaryId\":\"boundary_001\"}"
```

Generate report:

```bash
curl -X POST http://localhost:3000/api/v1/drone-operations/{id}/generate-report
```

Query import job:

```bash
curl http://localhost:3000/api/v1/drone-operations/import-jobs/{id}
```

## Mobile Integration

- `/api/v1/mobile/map`: drone operations, route layers, coverage layers, prescription layers.
- `/api/v1/mobile/operations`: drone mapping, spraying, spreading, and scouting operations.
- `/api/v1/mobile/fields/:fieldId/detail`: drone operation records, latest spraying report, latest mapping layer.
- `/api/v1/mobile/reports/summary`: drone operation count, spraying area total, average coverage rate, chemical usage total.

## Current Limitations

- No real DJI SDK integration.
- No real DJI private FlightRecord zip parsing.
- No complex polygon intersection.
- No real GeoTIFF raster analysis.
- No automatic drone control.
- KMZ zip parsing is only reserved as a TODO skeleton.
