# AgriOS Mobile V1.1 Map GIS Workbench

AgriOS Mobile V1.1 upgrades the mobile foundation into a GIS workbench foundation. It keeps the SVG/mock fallback and adds a map adapter architecture for future AMap, Google Maps, Baidu Map and drone orthomosaic layers.

## Goals

- Provide a real map container architecture.
- Render field boundaries, irrigation zones, GPS tracks, device markers and orthomosaic placeholder layers.
- Support manual polygon drawing.
- Support browser GPS boundary recording.
- Support FieldBoundary preview, creation, approval and archive.
- Keep backend safety as the final control point.

## Map Adapter Architecture

Adapters live in `apps/mobile/src/map-adapters`:

- `map-adapter.interface.ts`
- `mock-map.adapter.ts`
- `amap.adapter.ts`
- `google-map.adapter.ts`
- `baidu-map.adapter.ts`
- `index.ts`

Environment variables:

```text
VITE_MAP_PROVIDER=mock
VITE_AMAP_KEY=
VITE_GOOGLE_MAP_KEY=
VITE_BAIDU_MAP_KEY=
```

If SDK key is missing, the app falls back to `mock-map.adapter`.

## Layer Types

- FIELD
- IRRIGATION_ZONE
- VALVE
- SENSOR
- PUMP
- PIPELINE
- WATER
- OBSTACLE
- GPS_TRACK
- DRONE_ROUTE
- ORTHOMOSAIC

Layer switch state is stored in `localStorage`.

## Manual Boundary Drawing

Flow:

```text
Start drawing -> click map to add points -> close polygon -> estimate area -> POST /api/v1/gis/field-boundaries
```

The first version stores WGS84 GeoJSON and submits `source = MANUAL_DRAW`.

## GPS Boundary Recording

Flow:

```text
Start recording -> browser geolocation watchPosition -> collect points -> stop -> POST /api/v1/gis/gps-tracks/import
```

If `closeLoop = true`, backend creates a FieldBoundary candidate.

## Boundary Review

Route:

```text
/boundaries/review
```

APIs:

- `GET /api/v1/gis/field-boundaries?farmId=&status=CANDIDATE`
- `POST /api/v1/gis/field-boundaries/:id/approve`
- `POST /api/v1/gis/field-boundaries/:id/archive`

Approving a candidate creates a backend `MapLayer` of type `FIELD`.

## Backend GIS API Relationship

The frontend uses:

- `createFieldBoundary`
- `getFieldBoundaries`
- `approveFieldBoundary`
- `archiveFieldBoundary`
- `importGpsTrack`
- `getGpsTracks`
- `getMapLayers`
- `createMapLayer`
- `convertCoordinate`

## Roadmap

- KML/KMZ/GPX file upload.
- Drone orthomosaic rendering.
- AI boundary recognition.
- Irrigation zone editing.
- Drone route planning.
