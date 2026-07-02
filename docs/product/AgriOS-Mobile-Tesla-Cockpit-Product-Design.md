# AgriOS Mobile Tesla Cockpit Product Design

AgriOS Mobile is the agriculture version of a Tesla-like cockpit: map-first, safety-first, and built for fast field operations.

## Navigation

1. Cockpit
2. Map
3. Operations
4. AI
5. Profile

## Cockpit

- farm name
- weather summary
- device online rate
- auto mode state
- today risk level
- active irrigation zones
- today water usage
- pending alerts
- mini farm map
- AI recommendation card
- quick actions: emergency stop, manual valve, auto mode, alerts

## Map

- field boundaries
- irrigation zones
- valve markers
- sensor markers
- pump markers
- water channels
- pipelines
- obstacles
- drone routes
- GPS tracks
- orthomosaic map layer
- base map switch: Google, AMap, Baidu, drone orthomosaic
- WGS84 internal storage
- GCJ02/BD09 display conversion
- manual polygon drawing
- GPS walk boundary
- KML/KMZ/GPX/GeoJSON import
- future AI boundary recognition

## Field Detail

- crop type
- crop stage
- soil type
- area
- current moisture
- moisture trend
- irrigation history
- AI recommendation
- valve status
- sensor status
- drone operation records
- crop irrigation recipe
- wetting simulation preview

## Operations

- irrigation operations
- fertigation operations
- drone spraying
- drone seeding
- patrol detection
- device inspection
- action history
- execution status
- manual / assisted / auto mode

## AI

- AI irrigation recommendations
- reason explanation
- confidence score
- risk level
- expected water usage
- expected moisture increase
- wetting simulation result
- hydraulic check result
- execute / modify / reject / view simulation

## Alerts

- sensor offline
- valve execution failed
- water pressure abnormal
- soil moisture too low
- irrigation timeout
- pump abnormal
- each alert includes suggested fix

## Reports

- daily water usage
- monthly water usage
- water per mu
- device online rate
- action execution success rate
- AI adoption rate
- anomaly handling records
- export-ready project report

## Style

- map first
- Tesla-like cockpit
- agriculture green plus technology blue
- large cards
- large buttons
- outdoor readable
- safety controls obvious

## References

- XAG Farm: farm map and irrigation control
- Netafim GrowSphere: irrigation/fertigation operation system
- XGEO MAP: boundary recognition and drone route planning
- FieldNET/AgSense: remote control and diagnostics
- CropX: agronomic recommendations
- Hydrawise/Rachio: weather-aware irrigation automation
- ThingsBoard: telemetry and alert monitoring
