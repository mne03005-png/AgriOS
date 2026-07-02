# AgriOS P11.5 Drone File Import And Spatial Stats

## 目标

P11.5 在 P11.3/P11.4 的无人机作业数据基础上，补齐“文件导入 + 轻量空间统计 + 移动端查看”的闭环。

本阶段不做 DJI 私有协议破解，不复制 DJI/ThingsBoard 源码，不引入重型 GIS 依赖，也不默认触发无人机、阀门或水泵自动控制。

## 后端接口

### 上传无人机文件

```http
POST /api/v1/drone-operations/import-file
Content-Type: multipart/form-data
```

字段：

- `farmId`: 农场 ID，必填
- `fieldId`: 地块 ID，可选，优先用于地块匹配
- `source`: 数据来源，如 `DJI_SMARTFARM`、`DJI_TERRA`、`KML`、`GEOJSON`、`CSV`
- `operationType`: 作业类型，如 `SPRAYING`、`MAPPING`、`SCOUTING`
- `droneModel`: 无人机型号，可选
- `chemicalName`: 药剂或肥料名称，可选
- `sprayVolumeL`: 药液用量，可选
- `file`: 上传文件

允许扩展名：

- `.kml`
- `.geojson`
- `.json`
- `.csv`
- `.kmz`
- `.zip`
- `.tif`
- `.tiff`
- `.tfw`

拒绝脚本和可执行文件：

- `.exe`
- `.bat`
- `.cmd`
- `.ps1`
- `.js`
- `.mjs`
- `.vbs`
- `.sh`

文件大小限制为 10MB。后端读取文件 buffer，不长期保存原始文件。

## 解析能力

### KML

P11.5 使用轻量 KML 解析：

- 读取 `<coordinates>lng,lat,alt ...</coordinates>`
- `LineString` 转为航线 `routeGeoJson`
- `Polygon` 转为覆盖范围 `coverageGeoJson`
- `MultiGeometry` 中的多条线/多面会合并为 `MultiLineString` 或 `MultiPolygon`

坐标统一按 WGS84 GeoJSON 入库。

### GeoJSON

支持：

- `FeatureCollection`
- `Feature`
- `Polygon`
- `MultiPolygon`
- `LineString`
- `MultiLineString`

`Polygon/MultiPolygon` 用作覆盖范围，`LineString/MultiLineString` 用作航线。Feature properties 会保存在 `rawJson.properties` 中。

### CSV

支持经纬度字段：

- `lng/lat`
- `longitude/latitude`
- `lon/lat`

可选统计字段：

- `flow`
- `speed`
- `height`
- `sprayVolume`

CSV 会生成 `LineString` 航线，统计摘要保存在 `rawJson.properties.summary`。

### KMZ / ZIP / GeoTIFF

- `KMZ` / `ZIP`: P11.5 不引入解压依赖，上传后创建 `DroneImportJob`，状态为 `FAILED`，错误信息说明当前阶段限制。
- `GeoTIFF` / `TIF` / `TFW`: 仅记录元数据并创建影像/处方占位图层，不做栅格分析。

## 空间统计

P11.5 使用轻量 WGS84 统计：

- 覆盖面积 `actualAreaMu`
- 航线距离 `flightDistanceM`
- 覆盖率 `coverageRate`
- 漏喷面积 `missedAreaMu`
- 重复面积占位 `repeatedAreaMu = 0`
- 覆盖 bbox / 地块 bbox
- 覆盖中心点 / 航线中心点
- bbox overlap 估算

如果作业覆盖范围和 `FieldBoundary` 都存在：

- `actualAreaMu` 来自覆盖范围面积
- `coverageRate = min(coverageArea / fieldArea, 1)`
- `missedAreaMu = max(fieldArea - coverageArea, 0)`
- `overlapRate` 采用 bbox overlap 占位估算

精确 polygon intersection 后续可引入 PostGIS、turf.js 或 JSTS。

## 地块匹配

匹配优先级：

1. 如果上传时带 `fieldId`，优先绑定到该地块，并尝试寻找该地块的 `FieldBoundary`
2. 如果未带 `fieldId`，使用覆盖范围或航线中心点
3. 遍历同农场 `FieldBoundary`
4. 用中心点距离和 bbox overlap 计算候选分数
5. 成功后写入 `fieldId` / `fieldBoundaryId`，状态为 `LINKED`
6. 失败则保持 `PARSED`，并写入 `rawJson.matchResult.needsManualLink = true`

## 图层生成

导入后自动生成 MapLayer：

- 航线：`DRONE_ROUTE`
- 覆盖范围：`ORTHOMOSAIC` 类型承载，`styleJson.layerRole = DRONE_COVERAGE`
- GeoTIFF/处方占位：`ORTHOMOSAIC` 类型承载，`styleJson.layerRole = PRESCRIPTION_OR_ORTHOMOSAIC`

移动端地图会展示无人机航线、覆盖范围、影像/处方占位。点击无人机覆盖图层时展示作业卡片。

## 报告增强

`POST /api/v1/drone-operations/:id/generate-report` 会写入：

- source
- fileName
- operationType
- fieldAreaMu
- actualAreaMu
- coverageRate
- missedAreaMu
- repeatedAreaMu
- flightDistanceM
- flightDurationS
- sprayVolumeL
- dosagePerMu
- needsManualReview
- mapLayerIds

如果未能自动匹配地块或边界，报告会标记 `needsManualReview = true`。

## 事件和计费记录

事件：

- `drone.import.file.received`
- `drone.import.parsed`
- `drone.operation.stats.calculated`
- `drone.operation.report.generated`

用量记录：

- `DRONE_OPERATION`
- `DRONE_OPERATION_REPORT`

## 测试示例

```bash
curl -X POST http://localhost:3000/api/v1/drone-operations/import-file \
  -F "farmId=farm_001" \
  -F "fieldId=field_001" \
  -F "source=DJI_SMARTFARM" \
  -F "operationType=SPRAYING" \
  -F "droneModel=DJI Agras T50" \
  -F "chemicalName=onion fertilizer" \
  -F "sprayVolumeL=92" \
  -F "file=@./samples/onion-field-a.kml"
```

查询导入任务：

```bash
curl http://localhost:3000/api/v1/drone-operations/import-jobs/{jobId}
```

生成报告：

```bash
curl -X POST http://localhost:3000/api/v1/drone-operations/{operationId}/generate-report
```

## 后续建议

- 引入精确空间计算：PostGIS 或 turf.js
- 支持 KMZ 解压和 DJI FlightRecord 标准字段映射
- 支持 GeoTIFF 栅格读取、NDVI/DSM/处方图切片
- 增加人工地块匹配审核页面
- 将无人机作业结果纳入产量、成本和病虫害分析
