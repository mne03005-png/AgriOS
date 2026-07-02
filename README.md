# AgriOS

AgriOS 是面向中国县域农业、合作社、种植大户和家庭农场的农业数字化管理平台。

V1 聚焦家庭农田样板：地块档案、种植季、农资投入、农事记录、田间设备、传感器数据、灌溉记录、成本统计和服务信息库。

## 项目结构

```text
AgriOS/
├── apps/
│   ├── backend/      # NestJS API, Prisma, MQTT
│   ├── web-admin/    # 后续 Vue3 管理端
│   └── miniapp/      # 后续微信小程序
├── packages/
│   └── shared/       # 共享类型和常量
├── docs/
│   ├── product/
│   ├── database/
│   ├── api/
│   ├── hardware/
│   └── roadmap/
├── infra/
│   ├── docker/
│   ├── mqtt/
│   └── mysql/
└── scripts/
```

## 后端启动

```bash
cd apps/backend
npm.cmd install
npm.cmd run start:dev
```

## 数据库

默认使用 MySQL，配置在 `apps/backend/.env.example`。

```bash
cd infra/docker
docker compose up -d

cd ../../apps/backend
copy .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
npm run start:dev
```

服务启动后，API 前缀为 `http://localhost:3000/api/v1`。

## V1 不做

农资电商交易、农药在线销售、支付、物流、复杂 AI、全国平台、政府大屏、区块链溯源。

## P6 ThingsBoard 本地启动

P6.0 引入 ThingsBoard 作为物联网底座。AgriOS 管农业业务，ThingsBoard 管设备接入、遥测和设备状态。

启动 ThingsBoard CE + PostgreSQL：

```bash
cd infra/thingsboard
docker compose up -d
```

访问 ThingsBoard：

```text
http://localhost:8080
```

ThingsBoard MQTT 端口：

```text
localhost:18830
```

说明：

- `18830` 映射到 ThingsBoard 容器内 `1883`，避免和本机 Mosquitto `1883` 冲突。
- AgriOS 后续通过 ThingsBoard Webhook 接收遥测数据。
- 当前阶段不自动开泵，只自动生成灌溉建议，仍由人工确认执行。

## P6.1 ThingsBoard Webhook 测试

启动 ThingsBoard：

```bash
cd infra/thingsboard
docker compose up -d
```

访问：

```text
http://localhost:8080
```

MQTT：

```text
localhost:18830
```

启动 AgriOS 后端：

```bash
cd apps/backend
npm run start:dev
```

PowerShell curl 示例：

```powershell
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/telemetry `
  -H "Content-Type: application/json" `
  -H "x-thingsboard-secret: agrios_tb_secret" `
  -d "{\"deviceName\":\"soil_sensor_001\",\"soilMoisture\":22,\"temperature\":32,\"humidity\":65,\"ts\":1782780000000}"
```

Windows CMD curl 示例：

```cmd
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/telemetry ^
  -H "Content-Type: application/json" ^
  -H "x-thingsboard-secret: agrios_tb_secret" ^
  -d "{\"deviceName\":\"soil_sensor_001\",\"soilMoisture\":22,\"temperature\":32,\"humidity\":65,\"ts\":1782780000000}"
```

预期返回：

```json
{
  "accepted": true,
  "deviceName": "soil_sensor_001",
  "sensorRecordId": "...",
  "plotId": "...",
  "irrigationAdviceCreated": true,
  "irrigationAdviceId": "..."
}
```

如果设备未绑定地块，`plotId` 可能为 `null`，系统只保存遥测记录和操作日志，不生成灌溉建议。
## P6.2 ThingsBoard Device Sync and Rule Chain

P6.2 adds ThingsBoard device sync, device bind/unbind, device health query, webhook deduplication, and end-to-end smoke docs. AgriOS does not require ThingsBoard during backend startup. It connects to ThingsBoard only when the sync endpoint is called.

Environment variables:

```text
THINGSBOARD_BASE_URL=http://localhost:8080
THINGSBOARD_USERNAME=tenant@thingsboard.org
THINGSBOARD_PASSWORD=REPLACE_WITH_PASSWORD
THINGSBOARD_WEBHOOK_SECRET=REPLACE_WITH_RANDOM_SECRET
THINGSBOARD_SYNC_ENABLED=false
```

Sync ThingsBoard devices:

```bash
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/sync-devices
```

Bind a device to a field:

```bash
curl -X POST http://localhost:3000/api/v1/iot/devices/{deviceId}/bind-plot \
  -H "Content-Type: application/json" \
  -d "{\"plotId\":\"{fieldId}\"}"
```

Query device health:

```bash
curl http://localhost:3000/api/v1/iot/devices/{deviceId}/health
```

More details:

- `docs/iot/ThingsBoard-Webhook-RuleChain-配置步骤.md`
- `docs/iot/AgriOS-P6.2-ThingsBoard-E2E-Smoke.md`

## P6.3 ThingsBoard Asset, Health, Dead Letter

P6.3 adds ThingsBoard attributes/relations reading, attribute-based field binding, manual IoT device health check, and webhook dead letter records.

Sync ThingsBoard devices:

```bash
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/sync-devices
```

Check device health:

```bash
curl -X POST http://localhost:3000/api/v1/iot/devices/check-health
```

Normal telemetry:

```cmd
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/telemetry ^
  -H "Content-Type: application/json" ^
  -H "x-thingsboard-secret: agrios_tb_secret" ^
  -d "{\"deviceName\":\"soil_sensor_001\",\"soilMoisture\":22,\"temperature\":32,\"humidity\":65,\"battery\":88,\"ts\":1782780000000}"
```

PowerShell normal telemetry:

```powershell
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/telemetry `
  -H "Content-Type: application/json" `
  -H "x-thingsboard-secret: agrios_tb_secret" `
  -d "{\"deviceName\":\"soil_sensor_001\",\"soilMoisture\":22,\"temperature\":32,\"humidity\":65,\"battery\":88,\"ts\":1782780000000}"
```

Abnormal telemetry for dead letter test:

```cmd
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/telemetry ^
  -H "Content-Type: application/json" ^
  -H "x-thingsboard-secret: agrios_tb_secret" ^
  -d "{\"deviceName\":\"soil_sensor_001\",\"soilMoisture\":\"bad-number\",\"temperature\":\"abc\",\"ts\":\"bad-ts\"}"
```

PowerShell abnormal telemetry:

```powershell
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/telemetry `
  -H "Content-Type: application/json" `
  -H "x-thingsboard-secret: agrios_tb_secret" `
  -d "{\"deviceName\":\"soil_sensor_001\",\"soilMoisture\":\"bad-number\",\"temperature\":\"abc\",\"ts\":\"bad-ts\"}"
```

Dead letter list and resolve:

```bash
curl http://localhost:3000/api/v1/iot/webhook-dead-letters
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/mark-resolved -H "Content-Type: application/json" -d "{\"remark\":\"resolved\"}"
```

More details:

- `docs/iot/AgriOS-P6.3-ThingsBoard-Asset-And-Health.md`

## P6.4 Webhook Retry and Sync Audit

P6.4 adds single dead-letter retry, ThingsBoard sync audit records, and a fixed device ownership strategy through `Device.bindingSource`.

Dead Letter:

```bash
curl http://localhost:3000/api/v1/iot/webhook-dead-letters
curl "http://localhost:3000/api/v1/iot/webhook-dead-letters?status=PENDING&page=1&pageSize=20"
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/retry
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/mark-resolved
```

ThingsBoard sync audit:

```bash
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/sync-devices
curl http://localhost:3000/api/v1/iot/thingsboard/sync-audits
```

Manual bind and unbind:

```bash
curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/bind-plot \
  -H "Content-Type: application/json" \
  -d "{\"plotId\":\"field_or_plot_id\"}"

curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/unbind-plot
```

Windows CMD examples:

```cmd
curl http://localhost:3000/api/v1/iot/webhook-dead-letters
curl "http://localhost:3000/api/v1/iot/webhook-dead-letters?status=PENDING&page=1&pageSize=20"
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/retry
curl http://localhost:3000/api/v1/iot/thingsboard/sync-audits
```

PowerShell examples:

```powershell
curl http://localhost:3000/api/v1/iot/webhook-dead-letters
curl "http://localhost:3000/api/v1/iot/webhook-dead-letters?status=PENDING&page=1&pageSize=20"
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/retry
curl http://localhost:3000/api/v1/iot/thingsboard/sync-audits
```

More details:

- `docs/iot/AgriOS-P6.4-Webhook-Retry-And-Sync-Audit.md`

## P6.5 Dead Letter Batch and Binding Candidates

P6.5 adds Dead Letter batch handling, retry preview, sync audit detail, and ThingsBoard relation binding candidates.

Dead Letter preview and retry:

```bash
curl http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/preview
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/retry
```

Batch retry and batch resolved:

```cmd
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/batch-retry ^
  -H "Content-Type: application/json" ^
  -d "{\"ids\":[\"id1\",\"id2\"],\"maxCount\":20}"

curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/batch-mark-resolved ^
  -H "Content-Type: application/json" ^
  -d "{\"ids\":[\"id1\",\"id2\"],\"remark\":\"人工确认忽略\"}"
```

PowerShell:

```powershell
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/batch-retry `
  -H "Content-Type: application/json" `
  -d "{\"ids\":[\"id1\",\"id2\"],\"maxCount\":20}"

curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/batch-mark-resolved `
  -H "Content-Type: application/json" `
  -d "{\"ids\":[\"id1\",\"id2\"],\"remark\":\"人工确认忽略\"}"
```

Sync audit detail and binding candidates:

```bash
curl http://localhost:3000/api/v1/iot/thingsboard/sync-audits
curl http://localhost:3000/api/v1/iot/thingsboard/sync-audits/{id}
curl http://localhost:3000/api/v1/iot/devices/{id}/binding-candidates
```

More details:

- `docs/iot/AgriOS-P6.5-DeadLetter-Batch-And-Binding-Candidates.md`

## P6.6 Binding Approval and Audit Export

P6.6 adds Dead Letter diff reports, manual confirmation for binding candidates, and JSON export for ThingsBoard sync audits.

Dead Letter diff:

```bash
curl http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/diff
```

Binding candidate approval:

```cmd
curl http://localhost:3000/api/v1/iot/devices/{id}/binding-candidates

curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/confirm-binding-candidate ^
  -H "Content-Type: application/json" ^
  -d "{\"plotId\":\"field_or_plot_id\",\"source\":\"THINGSBOARD_RELATION\",\"remark\":\"人工确认 relation 对应此地块\"}"

curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/confirm-binding-candidate ^
  -H "Content-Type: application/json" ^
  -d "{\"plotId\":\"field_or_plot_id\",\"source\":\"THINGSBOARD_RELATION\",\"remark\":\"人工确认覆盖\",\"force\":true}"
```

PowerShell:

```powershell
curl http://localhost:3000/api/v1/iot/devices/{id}/binding-candidates

curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/confirm-binding-candidate `
  -H "Content-Type: application/json" `
  -d "{\"plotId\":\"field_or_plot_id\",\"source\":\"THINGSBOARD_RELATION\",\"remark\":\"人工确认 relation 对应此地块\"}"

curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/confirm-binding-candidate `
  -H "Content-Type: application/json" `
  -d "{\"plotId\":\"field_or_plot_id\",\"source\":\"THINGSBOARD_RELATION\",\"remark\":\"人工确认覆盖\",\"force\":true}"
```

Sync audit export:

```bash
curl "http://localhost:3000/api/v1/iot/thingsboard/sync-audits/{id}/export?format=json"
```

More details:

- `docs/iot/AgriOS-P6.6-Binding-Approval-And-Audit-Export.md`

## P7 Decision Engine and Closed-loop IoT

P7 adds a backend decision layer without changing existing ThingsBoard ingestion.

Run field decision:

```bash
curl -X POST http://localhost:3000/api/v1/decision-engine/fields/{fieldId}/run \
  -H "Content-Type: application/json" \
  -d "{\"autoExecute\":false,\"source\":\"MANUAL_TEST\"}"
```

Run closed-loop execution explicitly:

```bash
curl -X POST http://localhost:3000/api/v1/decision-engine/fields/{fieldId}/run \
  -H "Content-Type: application/json" \
  -d "{\"autoExecute\":true,\"source\":\"CLOSED_LOOP_TEST\"}"
```

Execute action plan and submit feedback:

```bash
curl -X POST http://localhost:3000/api/v1/decision-engine/action-plans/{id}/execute \
  -H "Content-Type: application/json" \
  -d "{\"force\":false}"

curl -X PATCH http://localhost:3000/api/v1/decision-engine/action-executions/{id}/feedback \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"ACKED\",\"message\":\"Pump started and confirmed\"}"
```

Query state and decisions:

```bash
curl http://localhost:3000/api/v1/decision-engine/decisions
curl http://localhost:3000/api/v1/decision-engine/fields/{fieldId}/state/latest
```

More details:

- `docs/iot/AgriOS-P7-Decision-Engine-Closed-Loop.md`

## P7.1 Irrigation Engineering And Recipe

P7.1 adds Netafim/GrowSphere-inspired irrigation engineering foundations without changing ThingsBoard/Webhook ingestion or P7 decision-engine APIs.

Core capabilities:

- irrigation design and zones
- BOM generation
- simplified hydraulic check
- crop irrigation recipes
- wetting simulation
- recipe-aware decision thresholds
- action-plan safety blocks for high deep-percolation risk, missing valve, or excessive irrigation duration

More details:

- `docs/iot/AgriOS-P7.1-Irrigation-Engineering-And-Recipe.md`

## P7.2 GIS Boundary Recognition Foundation

P7.2 adds the backend GIS foundation for land boundary recognition and map layer management. It does not change ThingsBoard/Webhook ingestion or P7 decision-engine APIs.

Core capabilities:

- field boundary candidate CRUD and approval
- GPS track import
- manual polygon drawing storage
- map layer management
- drone map job foundation
- placeholder AI recognition job
- WGS84 canonical storage with GCJ02/BD09 conversion APIs

Example:

```bash
curl -X POST http://localhost:3000/api/v1/gis/field-boundaries \
  -H "Content-Type: application/json" \
  -d "{\"farmId\":\"farm_001\",\"name\":\"洋葱地A边界候选\",\"source\":\"MANUAL_DRAW\",\"coordinateSystem\":\"WGS84\",\"polygon\":{\"type\":\"Polygon\",\"coordinates\":[[[118.1,36.7],[118.2,36.7],[118.2,36.8],[118.1,36.8],[118.1,36.7]]]}}"
```

More details:

- `docs/iot/AgriOS-P7.2-GIS-Boundary-Recognition-Foundation.md`

## P11 Commercial SaaS Foundation

P11 adds the production-oriented backend foundation for commercial farm deployments:

- tenant context and tenant records
- GIS boundary recognition foundation
- irrigation engineering design
- crop irrigation recipe
- wetting simulation
- safety policies and approval workflow
- action queue
- device-control abstraction
- event bus with event log
- mobile cockpit aggregation API
- billing usage records
- safe AI recommendation endpoint
- AI recommendation explanation API
- safety checks and approval workflow
- device-control abstraction
- execution modes: `MANUAL`, `ASSISTED`, `AUTO`
- farm KPI dashboard
- field digital-twin preview
- unified IoT integration adapter

Run database migration after pulling P11 changes:

```bash
cd apps/backend
npx prisma migrate dev
npx prisma generate
npm run start:dev
```

Important safety default:

```text
ENABLE_AUTO_EXECUTION=false
```

Set `ENABLE_AUTO_EXECUTION=true` only in a controlled test or production environment with validated safety rules and emergency stop procedures.

P11 API examples are documented in:

- `docs/api/AgriOS-V1-API测试样例.md`
- `docs/product/AgriOS-P11-商业化农业AI与IoT平台设计.md`
- `docs/iot/AgriOS-P11-Full-Data-Link-Audit.md`
- `docs/iot/AgriOS-P11-Commercial-Full-Stack-Integration.md`
- `docs/product/AgriOS-Mobile-Tesla-Cockpit-Product-Design.md`

## Mobile Frontend

AgriOS Mobile frontend foundation lives in `apps/mobile`.

It provides:

- Cockpit
- Map
- Operations
- AI
- Profile
- Field Detail
- Alerts
- Reports

Run:

```bash
npm install
npm run build --workspace apps/mobile
npm run dev --workspace apps/mobile
```

The first version uses SVG map placeholders and mock fallback when backend APIs are unavailable. Backend safety policy remains the final control point for emergency stop and valve operations.

More details:

- `docs/product/AgriOS-Mobile-Frontend-Implementation.md`

## Mobile V1.1 Map GIS Workbench

Mobile V1.1 adds a map workbench foundation:

- map adapter interface
- mock / AMap / Google / Baidu adapter skeletons
- map layer rendering and toggles
- manual field boundary drawing
- browser GPS boundary recording
- FieldBoundary candidate review
- GIS API wrapper

Default map provider is mock. Real SDK adapters are skeletons and fall back when keys are missing.

More details:

- `docs/product/AgriOS-Mobile-V1.1-Map-GIS-Workbench.md`

## P11.2 Rotation, Fertigation, Pressure and Flow

P11.2 adds backend foundations for irrigation rotation groups, normalized pump/valve/pressure/flow telemetry, fertigation tasks, operation reports, and farm activity timeline.

Core API groups:

```text
POST /api/v1/irrigation-rotation/groups
GET  /api/v1/irrigation-rotation/groups?farmId=
POST /api/v1/irrigation-rotation/groups/{id}/valves
POST /api/v1/irrigation-rotation/groups/{id}/schedules
POST /api/v1/irrigation-rotation/groups/{id}/start
POST /api/v1/irrigation-rotation/runs/{id}/stop

GET  /api/v1/iot/devices/{id}/telemetry/latest
GET  /api/v1/iot/farms/{farmId}/telemetry/summary

POST /api/v1/irrigation-monitoring/rules
GET  /api/v1/irrigation-monitoring/rules?farmId=
GET  /api/v1/irrigation-monitoring/anomalies?farmId=
PATCH /api/v1/irrigation-monitoring/anomalies/{id}/handle

POST /api/v1/fertigation/tanks
GET  /api/v1/fertigation/tanks?farmId=
PATCH /api/v1/fertigation/tanks/{id}
POST /api/v1/fertigation/recipes
GET  /api/v1/fertigation/recipes
POST /api/v1/fertigation/tasks
GET  /api/v1/fertigation/tasks?farmId=
POST /api/v1/fertigation/tasks/{id}/start
POST /api/v1/fertigation/tasks/{id}/cancel
POST /api/v1/fertigation/dissolve-tasks

GET  /api/v1/operation-reports?farmId=
GET  /api/v1/operation-reports/{id}
POST /api/v1/operation-reports/generate
GET  /api/v1/farm-activities?farmId=&fieldId=
```

Safety note: P11.2 still does not enable default automatic pump or valve execution. Rotation and fertigation starts create ActionPlan and ActionQueueJob first, then reuse the existing safety/device-control chain.

More details:

- `docs/iot/AgriOS-P11.2-Rotation-Fertigation-Pressure-Flow.md`

## P11.3 DJI Drone Data Integration Summary

P11.3 adds a backend foundation for DJI and common drone-exported operation data. It supports JSON payload import skeletons for DJI SmartFarm, DJI Terra, DJI Pilot, remote controller exports, KML, KMZ, GeoJSON, GeoTIFF metadata, CSV, and FlightRecord zip placeholders.

Core API group:

```text
POST  /api/v1/drone-operations/import
GET   /api/v1/drone-operations?farmId=&fieldId=
GET   /api/v1/drone-operations/{id}
PATCH /api/v1/drone-operations/{id}
POST  /api/v1/drone-operations/{id}/link-field
POST  /api/v1/drone-operations/{id}/generate-report
GET   /api/v1/drone-operations/import-jobs/{id}
```

Data link:

```text
DJI SmartFarm / DJI Terra / DJI Pilot export
 -> DroneImportJob
 -> DroneOperation
 -> MapLayer
 -> FieldBoundary matching
 -> OperationReport
 -> FarmActivity
 -> Mobile Cockpit
```

Safety note: P11.3 does not integrate the real DJI SDK and does not automatically control drones.

More details:

- `docs/iot/AgriOS-P11.3-DJI-Drone-Data-Integration.md`

## P11.4 Execution Result, Templates and Mobile Operational UI

P11.4 connects execution results back to business records and improves the mobile operational UI.

Core additions:

- `ExecutionResultLinkerService`
- default demo template seed
- mobile pressure/flow, pump, fertigation, activity cards
- mobile grouped operation view
- mobile drone operations page

Execution link:

```text
ActionExecution
 -> IrrigationRotationRun / FertigationTask
 -> OperationReport
 -> FarmActivity
 -> Mobile Cockpit
```

Default template seed:

```bash
cd apps/backend
npx prisma db seed
```

Safety note: P11.4 still does not enable default automatic pump or valve execution. DJI remains data import only and does not control drones.

More details:

- `docs/iot/AgriOS-P11.4-Execution-Result-And-Mobile-Operational-UI.md`

## P11.5 Drone File Import And Spatial Stats

P11.5 adds a practical drone file import path for backend and mobile:

- `POST /api/v1/drone-operations/import-file`
- multipart upload for KML, GeoJSON, JSON, CSV, KMZ, ZIP, TIF, TIFF, and TFW
- unsafe script/executable extensions are rejected
- KML/GeoJSON/CSV are parsed into WGS84 GeoJSON route or coverage geometry
- KMZ/ZIP are recorded as failed import jobs because extraction is reserved for a later stage
- GeoTIFF/TFW are recorded as metadata placeholders and map layers
- lightweight spatial statistics include area, route distance, bbox, centroid, coverage rate, missed area, and manual-link flag
- mobile drone import now supports both JSON paste and file upload

P11.5 still does not trigger automatic drone, pump, or valve control. It only imports files, calculates spatial stats, creates map layers, and generates drone operation reports.

More details:

- `docs/iot/AgriOS-P11.5-Drone-File-Import-And-Spatial-Stats.md`

## P11.6 Drone Review, Cost, Crop Health And Yield Foundation

P11.6 turns imported drone operation data into auditable business records:

- `DroneOperationReview` for manual import review
- manual field/boundary correction and coverage update
- operation cost placeholders for pesticide and drone service cost
- crop health observation placeholders for scouting/mapping operations
- yield analysis factors for drone spraying and scouting
- mobile `/drone-reviews` review console
- mobile `/operation-reports/:id` report detail page
- FieldDetail and Reports mobile summaries for cost, crop health and yield factors

Core API group:

```text
GET  /api/v1/drone-operations/reviews?farmId=&status=
GET  /api/v1/drone-operations/{id}/review
POST /api/v1/drone-operations/{id}/review/approve
POST /api/v1/drone-operations/{id}/review/reject
POST /api/v1/drone-operations/{id}/review/link-field
POST /api/v1/drone-operations/{id}/review/update-coverage
POST /api/v1/operation-costs
GET  /api/v1/operation-costs
GET  /api/v1/operation-costs/summary
POST /api/v1/crop-health/observations
GET  /api/v1/crop-health/observations
GET  /api/v1/crop-health/summary
POST /api/v1/yield-analysis/records
GET  /api/v1/yield-analysis/records
GET  /api/v1/yield-analysis/factors
GET  /api/v1/yield-analysis/summary
```

Safety note: P11.6 does not control drones, does not integrate the real DJI SDK, does not parse DJI private FlightRecord, and does not enable automatic pump or valve execution.

More details:

- `docs/iot/AgriOS-P11.6-Drone-Review-Cost-CropHealth-Yield.md`

## P11.6.1 Migration And Drone Review Smoke Test

P11.6.1 adds the database migration and smoke-test materials for the P11.6 drone review data link:

- P11.6 migration SQL generated
- drone review smoke-test document
- sample drone files for KML, GeoJSON and CSV parser checks
- backend PowerShell smoke-test script
- mobile route entry verification for drone reviews and operation report detail

Migration file:

```text
apps/backend/prisma/migrations/20260701000100_p11_6_drone_review_cost_crop_health_yield/migration.sql
```

Run order:

```bash
cd apps/backend
npx prisma migrate dev
npx prisma generate
npm run start:dev
```

Then:

- open the mobile app
- visit `/drone-operations`
- upload `samples/drone/onion-field-a.kml`
- visit `/drone-reviews`
- approve the review and generate a report
- visit `/reports`

Smoke test helper:

```powershell
apps/backend/scripts/p11_6_smoke_test.ps1
```

More details:

- `docs/iot/AgriOS-P11.6.1-Drone-Review-Smoke-Test.md`

## P11.7 Demo Farm One-Click Seed

P11.7 adds a repeatable demo baseline for a real product walkthrough:

- tenant: `AgriOS Demo Tenant`
- farm: `洋葱智慧农场 Demo`
- farm id: `demo`
- fields: `洋葱A区`, `洋葱B区`, `玉米试验区`
- field boundary and map layer
- demo devices and telemetry snapshots
- 24-hour soil moisture sensor records
- irrigation design, zone, BOM and hydraulic check
- crop irrigation recipe and wetting simulation
- rotation group, valve and schedule
- fertilizer tank, fertigation recipe and task
- drone operation, review and operation report
- operation costs, crop-health observations, yield factors and farm activities

Run:

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

Verify:

```text
GET /api/v1/mobile/cockpit?farmId=demo
GET /api/v1/mobile/map?farmId=demo
GET /api/v1/mobile/reports/summary?farmId=demo
```

More details:

- `docs/iot/AgriOS-P11.7-Demo-Farm-One-Click-Seed.md`

## P11.7.1 Database Env Fix And Demo Seed Verification

P11.7.1 documents and verifies the database environment required by the demo seed.

Prisma reads:

```text
DATABASE_URL
```

from the process environment or the backend Prisma `.env` convention:

```text
apps/backend/.env
```

Example only:

```text
DATABASE_URL="mysql://agrios:your_password@localhost:3306/agrios"
```

Do not commit real passwords.

Create database and user:

```sql
CREATE DATABASE agrios DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'agrios'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON agrios.* TO 'agrios'@'localhost';
FLUSH PRIVILEGES;
```

Run:

```bash
cd apps/backend
npx prisma migrate dev --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
npx prisma db seed
npm run start:dev
```

Verify:

```text
GET /api/v1/demo/health?farmId=demo
GET /api/v1/mobile/cockpit?farmId=demo
GET /api/v1/mobile/map?farmId=demo
GET /api/v1/mobile/reports/summary?farmId=demo
GET /api/v1/farm-activities?farmId=demo
GET /api/v1/drone-operations?farmId=demo
GET /api/v1/operation-reports?farmId=demo
```

PowerShell helper:

```text
apps/backend/scripts/p11_7_verify_demo_seed.ps1
```

Mobile demo entry:

- mobile default farm id is `demo`
- Profile has an `进入 Demo 农场` entry
- Cockpit, Map, Operations and Reports use the default demo farm when no explicit farm id is provided

Common errors:

- `Authentication failed`: wrong MySQL username/password or missing grant
- `Unknown database`: create the `agrios` database first
- `migration_lock.toml missing`: historical migration folder is incomplete; do not delete old migrations
- empty Prisma schema engine error: verify `DATABASE_URL`, then run `prisma validate` and `prisma migrate status`

More details:

- `docs/iot/AgriOS-P11.7.1-Database-Seed-Verification.md`

## P11.7.2 Demo Acceptance Summary

P11.7.2 adds demo readiness checks and showcase safeguards:

- enhanced `GET /api/v1/demo/health?farmId=demo`
- `isReady`, `missingItems`, `warnings`, `recommendedActions`
- per-module status for tenant, farm, fields, boundaries, map layers, devices, telemetry, sensor records, irrigation design, BOM, hydraulic check, crop recipe, wetting simulation, rotation, fertigation, drone operation, drone review, operation report, operation cost, crop health, yield factor, farm activity and mobile cockpit
- PowerShell acceptance script: `apps/backend/scripts/p11_7_2_demo_acceptance.ps1`
- mobile `/demo-status` page
- empty-data prompts for Cockpit, Map, Operations, Reports and Drone Operations

Showcase flow:

```text
Cockpit -> Map -> Operations -> Drone Operations -> Drone Reviews -> Reports -> Field Detail -> Demo Status
```

More details:

- `docs/product/AgriOS-P11.7.2-Demo-Acceptance-And-Showcase.md`

## P11.7.3 Demo Showcase Polish

P11.7.3 polishes the mobile demo into a recording-ready showcase:

- unified `AgriOS Mobile / 农业版特斯拉中控屏` header
- demo farm label: `洋葱智慧农场 Demo · farmId=demo`
- `/showcase` one-click demo navigation path
- cockpit product cards for risk, online rate, water, drone operations, rotation, fertigation and farm activities
- cockpit-style SVG map fallback
- report narrative for irrigation, drone coverage, cost, crop health and yield factors
- field detail lifecycle layout
- recording script document

Start backend:

```bash
cd apps/backend
npm run start:dev
```

Start mobile, then visit:

```text
/showcase
```

Recommended recording order:

```text
Demo Status -> Cockpit -> Map -> Operations -> Drone Operations -> Drone Reviews -> Reports -> Field Detail
```

Demo health check:

```text
/demo-status
GET /api/v1/demo/health?farmId=demo
```

More details:

- `docs/product/AgriOS-P11.7.3-Demo-Recording-Script.md`
## P12 Production Hardening Summary

P12 adds the production hardening foundation while keeping the P11 demo farm usable:

- Config validation for `DATABASE_URL`, JWT, upload limits, CORS, device control mode and auto execution.
- JWT/RBAC foundation with `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/me`.
- Tenant isolation foundation with request context, tenant guard and Prisma tenant helper.
- ActionQueue adapter foundation with BullMQ/Redis entry point and memory fallback.
- Health/readiness endpoints: `/api/v1/health/live`, `/api/v1/health/ready`, `/api/v1/health/modules`, `/api/v1/health/metrics`.
- Upload security for drone import files.
- Audit events at `/api/v1/audit/events`.
- RequestId in error responses.
- Docker Compose deployment baseline in `docker-compose.p12.yml`.
- Mobile auth login page at `/login`; demo fallback remains available.
- If Redis or BullMQ is unavailable, ActionQueue falls back to memory mode with a warning.

Environment example:

```env
DATABASE_URL="mysql://agrios:your_password@localhost:3306/agrios"
REDIS_URL="redis://localhost:6379"
JWT_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET
JWT_EXPIRES_IN="7d"
ENABLE_AUTO_EXECUTION=false
DEVICE_CONTROL_MODE=MOCK
UPLOAD_MAX_FILE_MB=20
CORS_ORIGINS="http://localhost:5174,http://localhost:5173"
ACTION_QUEUE_DRIVER=bullmq
ACTION_QUEUE_MAX_RETRIES=3
```

Common commands:

```powershell
npm run build --workspace apps/backend
npm run build --workspace apps/mobile
docker compose -f docker-compose.p12.yml up -d
cd apps/backend
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

Safety defaults:

- `ENABLE_AUTO_EXECUTION=false`
- `DEVICE_CONTROL_MODE=MOCK`
- P12 does not control drones.
- P12 does not change the ThingsBoard/Webhook ingestion flow.

## P12.1-P12.6 Production Architecture Expansion

P12.1:
- Final IoT Architecture.
- ThingsBoard 定位为设备机房，AgriOS 定位为农业驾驶舱。
- 三种生产控制路径：ThingsBoard Cloud、Edge/PLC、Bluetooth local maintenance。
- DeviceControl mode standardization.
- Tenant guard high-risk enforcement.

P12.2:
- ThingsBoard Installer Kit.
- Device profile templates under `templates/thingsboard`.
- Rule chain and installer dashboard skeleton templates.
- `DeviceInstallationCheck` model and installer checks API.
- Mobile installer entry at `/installer-checks`.

P12.3:
- AgriOS Edge Gateway Foundation.
- `EdgeGateway / EdgeDeviceBinding / EdgeCommand`.
- `EDGE_HTTP / PLC_GATEWAY` adapter skeleton.
- Mobile Edge status page at `/edge-gateways`.

P12.4:
- AI Telemetry Analysis Pipeline.
- Explainable `AIRecommendation`.
- Rule-based telemetry analyzer, risk score and explainer services.
- Mobile AI cards consume `/api/v1/ai-recommendations`.

P12.5:
- Bluetooth Installer / Maintenance Mode.
- `BluetoothSession / BluetoothOperationLog`.
- Bluetooth API and Mobile page at `/bluetooth-maintenance`.
- BLE is skeleton only and cannot bypass Safety / Approval.

P12.6:
- Production Permission Matrix.
- Central `PermissionGuard`, permission constants and role matrix.
- High-risk permission enforcement for action queue, device control, safety, approval, drone review, edge, bluetooth, audit and billing.
- Permission test script and mobile role hints.

## P13.0 Real Device Integration And Hardware Simulation Kit

P13.0 adds a safe real-device integration plan and local simulation kit. It does not change the existing ThingsBoard/Webhook ingestion flow, does not auto-open pumps or valves, and does not control drones.

New field integration docs:

- `docs/field/AgriOS-P13-Real-Device-Integration-Plan.md`
- `docs/field/AgriOS-P13-Device-Protocol-Spec.md`
- `docs/field/AgriOS-P13-ThingsBoard-RuleChain-Test-Guide.md`
- `docs/field/AgriOS-P13-Edge-Controller-API-Spec.md`

Run simulators:

```powershell
cd apps/backend
npm run sim:p13:edge
npm run sim:p13:thingsboard
npm run sim:p13:mqtt
```

Useful simulator environment variables:

```env
AGRIOS_API_URL=http://localhost:3000/api/v1
THINGSBOARD_WEBHOOK_SECRET=REPLACE_WITH_RANDOM_SECRET
MQTT_BROKER_URL=mqtt://localhost:1883
DEVICE_CODE=demo-soil-sensor-a
SCENARIO=normal
EDGE_SIM_PORT=18080
```

To test AgriOS against the mock Edge controller:

```env
DEVICE_CONTROL_MODE=EDGE_HTTP
EDGE_CONTROLLER_BASE_URL=http://localhost:18080
EDGE_CONTROLLER_TOKEN=REPLACE_WITH_RANDOM_TOKEN
ENABLE_AUTO_EXECUTION=false
```

Smoke test:

```powershell
apps/backend/scripts/p13_device_integration_smoke_test.ps1
```

Mobile debug entry:

```text
/device-integration
```

The page shows DeviceControl mode, ThingsBoard/Edge/Bluetooth readiness, latest telemetry summary, AI recommendation count, action queue status, edge command status and audit summaries. It does not expose tokens or provide direct pump/valve buttons.

## P13.1 Real Sensor Telemetry Integration

P13.1 adds the first low-risk real sensor telemetry path. It validates sensor telemetry ingestion only and still does not auto-open pumps, valves, drones, or any other hardware.

Supported payload shapes:

- wrapped telemetry: `{ "deviceName": "...", "deviceId": "...", "telemetry": { "soilMoisture": 31.2 } }`
- flat telemetry: `{ "soilMoisture": 31.2, "soilTemperature": 22.5 }`
- `values` wrapper: `{ "values": { "soilMoisture": 31.2 } }`
- common vendor fields: `{ "temperature": 22.5, "humidity": 60, "moisture": 31.2 }`

Field mapping:

- `moisture` -> `soilMoisture`
- `temp`, `temperature` -> `soilTemperature`
- `humidity` -> `airHumidity`
- `rssi`, `signal`, `signalStrength` -> `signalStrength`
- `battery`, `batteryLevel` -> `batteryPercent`

New helper APIs:

```text
GET  /api/v1/iot/devices/binding-candidates?thingsboardDeviceId=&deviceName=
POST /api/v1/iot/devices/:id/link-thingsboard
GET  /api/v1/iot/farms/:farmId/telemetry/latest-real-sensor
```

Verification:

```powershell
apps/backend/scripts/p13_1_real_sensor_telemetry_check.ps1 -BaseUrl http://localhost:3000/api/v1 -FarmId demo
```

Mobile `/device-integration` now includes a Real Sensor Telemetry panel with latest SensorRecord, latest DeviceTelemetrySnapshot, normalized telemetry preview, binding status, and ThingsBoard identity.

More details:

- `docs/field/AgriOS-P13.1-Real-Sensor-Telemetry-Integration.md`

## P13.2 Electric Valve Controller Safe Dry-Run

P13.2 adds the first safe electric-valve control loop. It is dry-run by default and does not open a real valve or start a pump.

Safety defaults:

```env
DEVICE_CONTROL_DRY_RUN=true
VALVE_COMMAND_TIMEOUT_MS=10000
VALVE_MAX_OPEN_SECONDS=30
VALVE_REQUIRE_FEEDBACK=true
VALVE_ALLOW_REAL_CONTROL=false
```

Supported control paths:

- ThingsBoard Cloud: AgriOS -> Safety -> Approval -> ActionQueue -> DeviceControl -> ThingsBoard RPC -> Gateway -> Valve Controller
- Edge Local: AgriOS -> Safety -> Approval -> ActionQueue -> DeviceControl -> Edge HTTP -> Local Gateway / PLC -> Valve Controller
- MQTT Direct: AgriOS -> Safety -> Approval -> ActionQueue -> DeviceControl -> MQTT Broker -> Valve Controller

Supported commands:

- `OPEN`
- `CLOSE`
- `SET_OPENING`
- `READ_STATUS`
- `TEST_OPEN`

Valve APIs:

```text
POST /api/v1/device-control/valves/:deviceId/open
POST /api/v1/device-control/valves/:deviceId/close
POST /api/v1/device-control/valves/:deviceId/set-opening
POST /api/v1/device-control/valves/:deviceId/test-open
GET  /api/v1/device-control/valves/:deviceId/status
GET  /api/v1/device-control/valves/:deviceId/commands
POST /api/v1/device-control/valves/feedback
```

ACK / timeout / failure handling:

- ACK updates `DeviceCommand`, `ActionExecution`, and device `currentStatus`.
- Duplicate ACK is idempotent.
- Unknown `commandId` is recorded as a feedback dead-letter style event.
- Timeout/failure status is recorded without creating duplicate operation reports.

Templates and simulator:

- `templates/thingsboard/device-profiles/electric-valve-profile.json`
- `templates/thingsboard/rule-chains/agrios-valve-command-feedback-rule-chain.json`
- `apps/backend/scripts/simulators/valve-controller-simulator.ts`

Run simulator:

```powershell
npm run sim:p13:valve --workspace apps/backend
npm run sim:p13:valve:failure --workspace apps/backend
npm run sim:p13:valve:timeout --workspace apps/backend
```

Verification:

```powershell
apps/backend/scripts/p13_2_valve_dry_run_check.ps1 -BaseUrl http://localhost:3000/api/v1
```

Mobile debug page:

```text
/valve-control-test
```

Important restrictions:

- Opening a valve does not start a pump.
- Real valve control is blocked unless explicitly configured and approved.
- Edge / PLC is the recommended production path.
- ThingsBoard Cloud is a compatible path.
- Bluetooth is for installation and maintenance.
- P13.2 does not control drones and does not change the ThingsBoard/Webhook telemetry ingestion chain.

More details:

- `docs/field/AgriOS-P13.2-Electric-Valve-Controller-Integration.md`
