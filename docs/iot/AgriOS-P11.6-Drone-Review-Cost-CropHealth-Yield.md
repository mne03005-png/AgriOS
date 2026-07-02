# AgriOS P11.6 Drone Review, Cost, Crop Health And Yield Foundation

## 目标

P11.6 把 P11.5 的无人机文件导入结果继续业务化：从“导入一份空间数据”升级为“人工审核、修正地块、沉淀作业成本、巡田观察和产量分析因素”。

本阶段仍然不控制无人机，不接真实 DJI SDK，不解析 DJI 私有 FlightRecord，不做复杂 GeoTIFF 栅格分析，也不默认自动开泵或开阀。

## 审核流程

数据链路：

```text
DroneImportJob
 -> DroneOperation
 -> DroneOperationReview
 -> FieldBoundary link
 -> Spatial stats
 -> OperationReport
 -> OperationCost
 -> CropHealthObservation
 -> YieldFactor
 -> Mobile Reports
```

导入完成后系统自动创建 `DroneOperationReview`：

- 如果未能匹配地块，状态为 `NEEDS_MANUAL_LINK`
- 如果覆盖率低于 90%，状态为 `NEEDS_BOUNDARY_FIX`
- 其他情况状态为 `PENDING`

人工审核接口：

```text
GET  /api/v1/drone-operations/reviews?farmId=&status=
GET  /api/v1/drone-operations/:id/review
POST /api/v1/drone-operations/:id/review/approve
POST /api/v1/drone-operations/:id/review/reject
POST /api/v1/drone-operations/:id/review/link-field
POST /api/v1/drone-operations/:id/review/update-coverage
```

审核通过后：

- `DroneOperation.status = REVIEWED`
- 写入 `FarmActivity: DRONE_OPERATION_REVIEWED`
- 创建无人机作业成本占位
- 对巡田/测绘作业创建 `CropHealthObservation` 占位
- 对喷洒/巡田/测绘作业创建 `YieldFactor`

审核拒绝后：

- `DroneOperation.status = ARCHIVED`
- `DroneOperationReview.status = REJECTED`

## 人工绑定地块

`link-field` 用于修正无人机作业归属：

```json
{
  "fieldId": "field_001",
  "fieldBoundaryId": "boundary_001",
  "reviewNote": "人工确认该作业属于洋葱地A"
}
```

绑定后系统会重新计算：

- 作业面积
- 覆盖率
- 漏喷面积
- 重喷面积占位
- bbox overlap

## 覆盖区修正

`update-coverage` 支持传入修正后的 `correctedCoverageGeoJson` 或 `correctedRouteGeoJson`，系统重新计算轻量空间统计。

P11.6 不提供复杂 polygon 编辑器。移动端只提供审核入口，复杂编辑留给后续 GIS 工作台。

## 无人机作业成本

新增 `OperationCost`：

- `PESTICIDE`
- `FERTILIZER`
- `WATER`
- `ELECTRICITY`
- `LABOR`
- `DRONE_SERVICE`
- `MACHINE`
- `OTHER`

接口：

```text
POST /api/v1/operation-costs
GET  /api/v1/operation-costs?farmId=&fieldId=&refType=&refId=
GET  /api/v1/operation-costs/summary?farmId=&fieldId=
```

无人机喷洒作业审核通过后，系统会创建成本占位：

- 如果存在 `chemicalName`，创建 `PESTICIDE` 占位
- 如果 `operationType = SPRAYING`，创建 `DRONE_SERVICE` 占位
- 金额允许为 0，等待用户后续补录单价或实际服务费

## 病虫害 / 巡田观察

新增 `CropHealthObservation`，用于记录人工、无人机、传感器或 AI 识别产生的巡田观察。

接口：

```text
POST /api/v1/crop-health/observations
GET  /api/v1/crop-health/observations?farmId=&fieldId=
GET  /api/v1/crop-health/summary?farmId=&fieldId=
```

如果无人机作业类型是 `SCOUTING` 或 `MAPPING`，审核通过后会生成巡田观察占位。P11.6 不做真实病虫害 AI 识别。

## 产量分析基础数据

新增：

- `YieldRecord`
- `YieldFactor`

接口：

```text
POST /api/v1/yield-analysis/records
GET  /api/v1/yield-analysis/records?farmId=&fieldId=
GET  /api/v1/yield-analysis/factors?farmId=&fieldId=
GET  /api/v1/yield-analysis/summary?farmId=&fieldId=
```

无人机作业审核通过后：

- 喷洒作业生成 `YieldFactor: DRONE_SPRAYING`
- 巡田/测绘作业生成 `YieldFactor: DRONE_SCOUTING`

这些因素后续可用于分析投入、病虫害、灌溉、水肥和产量之间的关系。

## Mobile 审核台

新增页面：

- `/drone-reviews`
- `/operation-reports/:id`

移动端能力：

- 查看待审核 `DroneOperationReview`
- 查看来源、文件名、无人机型号、作业类型
- 查看匹配地块、面积、覆盖率、漏喷/重喷面积
- 批准、拒绝、绑定地块
- 查看作业报告详情
- FieldDetail 展示无人机作业、成本、巡田观察、产量因素和最新报告
- Reports 展示作业成本、用药量、无人机服务成本、观察次数和产量因素数量

## 当前限制

- 未做复杂 polygon 编辑器
- 未做真实病虫害 AI 识别
- 未做真实产量预测
- 未接 DJI SDK
- 未自动控制无人机
- 未默认自动开泵或开阀
- 覆盖率和重喷/漏喷仍为轻量空间统计，精确 polygon intersection 后续可用 PostGIS 或 turf.js 增强
