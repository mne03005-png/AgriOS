# AgriOS P7.2 GIS Boundary Recognition Foundation

P7.2 建立 AgriOS 的 GIS 基础能力，用于地块边界识别、地图图层管理、手持 GPS 轨迹导入、无人机航线/正射图任务记录、人工绘制多边形和后续 AI 识别。

本阶段不修改 ThingsBoard/Webhook 遥测接入逻辑，也不修改 P7 决策引擎链路。

## 目标

- 建立统一 GIS 数据模型。
- 支持地块边界候选、审核、归档。
- 支持 GPS 轨迹导入并可闭合生成边界候选。
- 支持地图图层管理，覆盖地块、水体、道路、管线、设备、无人机路线和灌溉分区。
- 支持无人机地图任务基础记录。
- 为未来 AI 边界识别、无人机作业路径规划、灌溉分区规划预留接口。
- 该 GIS 引擎可复用于未来渔业应用中的水体边界识别。

## 数据来源

- 人工绘制：`MANUAL_DRAW`
- 手持 GPS：`HANDHELD_GPS`
- 无人机飞行轨迹：`DRONE_FLIGHT`
- 无人机正射影像：`DRONE_ORTHOMOSAIC`
- Google 地图：`GOOGLE_MAP`
- 高德地图：`AMAP`
- 百度地图：`BAIDU_MAP`
- AI 识别：`AI_RECOGNITION`

## 坐标系统

支持：

- `WGS84`
- `GCJ02`
- `BD09`

AgriOS 内部标准存储坐标系为 `WGS84`。所有写入的边界、多边形、轨迹和图层会先归一化到 `WGS84` 后保存。

显示策略：

- Google/卫星底图优先使用 `WGS84`。
- 高德地图显示时由前端或地图适配层转换到 `GCJ02`。
- 百度地图显示时由前端或地图适配层转换到 `BD09`。

## 核心接口

```text
POST  /api/v1/gis/field-boundaries
GET   /api/v1/gis/field-boundaries
GET   /api/v1/gis/field-boundaries/:id
PATCH /api/v1/gis/field-boundaries/:id
POST  /api/v1/gis/field-boundaries/:id/approve
POST  /api/v1/gis/field-boundaries/:id/archive

POST  /api/v1/gis/gps-tracks/import
GET   /api/v1/gis/gps-tracks

POST  /api/v1/gis/map-layers
GET   /api/v1/gis/map-layers
PATCH /api/v1/gis/map-layers/:id

POST  /api/v1/gis/recognition/field-boundary
GET   /api/v1/gis/recognition/jobs/:id

POST  /api/v1/gis/coordinate/convert

POST  /api/v1/gis/drone-map-jobs
GET   /api/v1/gis/drone-map-jobs
```

## GPS 轨迹导入

支持两种初始格式：

- GeoJSON `LineString`
- 点数组：`[{ "lng": 118.1, "lat": 36.7, "timestamp": "..." }]`

如果 `closeLoop=true`，系统会把轨迹闭合为 Polygon，并生成一条 `FieldBoundary` 候选记录。

## 无人机地图任务

P7.2 只记录基础任务：

- 航线轨迹
- 图片数量
- 正射影像 URL
- 任务状态

后续可接入正射图拼接、影像分割、障碍物识别和边界自动提取。

## 边界识别基础

P7.2 的识别逻辑是占位式规则流程：

- 输入可以是 `mapLayerId`、`gpsTrackId`、`droneMapJobId` 或上传 GeoJSON。
- 如果输入包含 Polygon 或闭合 LineString，则生成边界候选。
- 创建 `AIRecognitionJob` 并记录状态。
- 不引入重型 AI/图像依赖。

## 未来路线

- P7.3：前端地图绘制与边界审核工作台。
- P7.4：无人机航线规划和作业区域避障。
- P7.5：AI 正射图边界识别。
- P7.6：灌溉分区规划与设备联动。
- P7.7：共享 GIS 引擎抽象到农业和渔业多业务线。
