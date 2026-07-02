# AgriOS Mobile Frontend Implementation

AgriOS Mobile is a Vue3 + Vite H5 foundation for the future mini app/mobile cockpit. It is designed as an agriculture Tesla-like cockpit: map-first, large controls, outdoor-readable cards, and safety-first operations.

## Tech Stack

- Vue 3
- Vite
- Vue Router
- TypeScript
- Native CSS, no heavy UI framework

## Page Structure

- `CockpitPage.vue`: farm overview, risk cards, mini map, AI recommendation, quick actions
- `MapPage.vue`: SVG map placeholder, layer toggles, field bottom sheet
- `FieldDetailPage.vue`: field data, moisture, valve/sensor status, recipe, wetting simulation, design status
- `OperationsPage.vue`: action plans, execution records, operation placeholders
- `AIPage.vue`: recommendation cards and approval indication
- `AlertsPage.vue`: alerts and suggested handling
- `ReportsPage.vue`: water/device/action summary cards
- `ProfilePage.vue`: settings and commercial/admin entry points

## API Integration

API wrappers are in `apps/mobile/src/api`:

- `mobile-api.ts`
- `gis-api.ts`
- `control-api.ts`
- `approval-api.ts`
- `http.ts`

Default API base URL:

```text
http://localhost:3000/api/v1
```

Override with:

```text
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

## Components

Cockpit:

- `FarmStatusHeader`
- `RiskCards`
- `MiniFarmMap`
- `AIRecommendationCard`
- `QuickActions`

Map:

- `FarmMapCanvas`
- `LayerPanel`
- `FieldBottomSheet`
- `MapToolbar`

Control:

- `EmergencyStopButton`
- `ValveControlPanel`
- `ExecutionModeSwitch`

AI:

- `DecisionExplanationCard`
- `RiskBadge`

Common:

- `AppTabBar`
- `StatusBadge`
- `LoadingState`

## Safety Operations

Dangerous operations use browser confirmation before submitting:

- emergency stop
- manual valve open/close

The frontend never bypasses backend safety. Backend safety policy, approval, queue, and device-control services remain the final control point.

## Mock Fallback

If backend APIs are unavailable, pages render mock data and show a banner: `当前为模拟数据`. This keeps the mobile app previewable without starting backend services.

## Map SDK Roadmap

The current map uses SVG placeholders. Future work can replace it with Google, AMap, Baidu, or drone orthomosaic adapters while keeping internal WGS84 storage and display conversion at adapter level.
