# AgriOS P6.5 DeadLetter Batch And Binding Candidates

P6.5 继续增强 ThingsBoard 运维闭环：Dead Letter 批量处理、重放前预览、同步审计详情、以及 ThingsBoard relation 到 AgriOS Farm/Field 的候选绑定建议。

## 1. P6.5 目标

- 支持 Dead Letter 批量 retry。
- 支持 Dead Letter 批量标记 resolved。
- 支持 Dead Letter retry 前 preview。
- 支持 Sync Audit 详情查询。
- 支持设备绑定候选建议。
- 不做前端页面。
- 不自动开泵。
- 不自动开阀。
- 不复制 ThingsBoard 源码。

## 2. Dead Letter 批量 retry

指定 ID 批量 retry：

```bash
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/batch-retry \
  -H "Content-Type: application/json" \
  -d "{\"ids\":[\"id1\",\"id2\"],\"maxCount\":20}"
```

如果不传 `ids`，系统会按 `status=PENDING` 取一批，受 `maxCount` 限制。

规则：

- `maxCount` 默认 20，最大 50。
- 每条 Dead Letter 单独处理。
- 单条失败不会影响整批。
- `RESOLVED` 默认跳过。
- 不做定时任务。
- 不做无限重试。

## 3. Dead Letter 批量 resolved

```bash
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/batch-mark-resolved \
  -H "Content-Type: application/json" \
  -d "{\"ids\":[\"id1\",\"id2\"],\"remark\":\"人工确认忽略\"}"
```

每条记录会写入 `resolvedAt`，并返回每条处理结果。

## 4. Dead Letter preview

```bash
curl http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/preview
```

preview 会解析 `rawPayload`，尝试判断：

- `deviceName`
- `thingsboardDeviceId`
- `soilMoisture`
- `temperature`
- `humidity`
- `battery`
- `recordedAt`
- 是否匹配 AgriOS Device
- 是否已绑定 Field
- 是否可能重复 telemetry
- 是否可能生成 IrrigationAdvice

preview 不写数据库，不创建 SensorRecord，不创建 IrrigationAdvice，也不改变 Dead Letter 状态。

## 5. Sync Audit 详情

查询列表：

```bash
curl http://localhost:3000/api/v1/iot/thingsboard/sync-audits
```

查询详情：

```bash
curl http://localhost:3000/api/v1/iot/thingsboard/sync-audits/{id}
```

详情返回 `source`、`syncType`、`total`、`created`、`updated`、`bound`、`unbound`、`warnings`、`rawResult`、`startedAt`、`finishedAt`。

## 6. Binding Candidates

```bash
curl http://localhost:3000/api/v1/iot/devices/{id}/binding-candidates
```

候选来源：

- ThingsBoard device relation
- ThingsBoard asset relation
- ThingsBoard asset name
- ThingsBoard asset attributes
- device attributes 中的 `farmId`、`plotId`、`agriosFarmId`、`agriosPlotId`

返回结果只做建议，不改变设备绑定。

如果 `bindingSource = MANUAL`，返回中会明确提示不会自动覆盖手动绑定。

## 7. 设备归属冲突策略

优先复用：

- `IoTSyncAudit.warnings`
- `IoTSyncAudit.rawResult`
- `OperationLog`

冲突场景：

- 当前设备是手动绑定，但 ThingsBoard `agriosPlotId` 指向另一个 plot。
- 当前设备已有 plotId，但 ThingsBoard `plotId` 指向另一个 plot。
- ThingsBoard relation 指向的 asset 无法匹配 AgriOS Field/Farm。
- ThingsBoard 属性提供的 plotId 不存在。

处理策略：

- 不自动覆盖 `MANUAL` 绑定。
- 冲突写入 sync warnings。
- 找不到 Field/Farm 时不报错。
- relation 永远只做候选建议，除非后续人工确认。

## 8. PowerShell 示例

```powershell
curl http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/preview
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/retry
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/batch-retry `
  -H "Content-Type: application/json" `
  -d "{\"ids\":[\"id1\",\"id2\"],\"maxCount\":20}"
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/batch-mark-resolved `
  -H "Content-Type: application/json" `
  -d "{\"ids\":[\"id1\",\"id2\"],\"remark\":\"人工确认忽略\"}"
curl http://localhost:3000/api/v1/iot/thingsboard/sync-audits/{id}
curl http://localhost:3000/api/v1/iot/devices/{id}/binding-candidates
```

## 9. Windows CMD 示例

```cmd
curl http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/preview
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/retry
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/batch-retry ^
  -H "Content-Type: application/json" ^
  -d "{\"ids\":[\"id1\",\"id2\"],\"maxCount\":20}"
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/batch-mark-resolved ^
  -H "Content-Type: application/json" ^
  -d "{\"ids\":[\"id1\",\"id2\"],\"remark\":\"人工确认忽略\"}"
curl http://localhost:3000/api/v1/iot/thingsboard/sync-audits/{id}
curl http://localhost:3000/api/v1/iot/devices/{id}/binding-candidates
```
