# AgriOS P6.6 Binding Approval And Audit Export

P6.6 增强 ThingsBoard 运维闭环：Dead Letter 重放差异报告、候选绑定人工确认、同步审计 JSON 导出，以及 relation 半自动绑定审批流。

## 1. P6.6 目标

- Dead Letter retry 前提供 diff report。
- 设备 binding candidates 支持人工确认后真正绑定。
- 支持 Sync Audit JSON 导出。
- ThingsBoard relation 仍只作为候选建议，不自动覆盖 AgriOS 绑定。
- 不做前端页面。
- 不自动开泵。
- 不自动开阀。
- 不复制 ThingsBoard 源码。

## 2. Dead Letter Diff Report

```bash
curl http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/diff
```

diff 会复用 preview 解析逻辑，判断 retry 后可能发生的变化：

- 是否会新建 SensorRecord。
- 是否识别为重复 telemetry。
- 是否可能新建 IrrigationAdvice。
- 是否会因为重复灌溉建议而跳过。
- 当前设备是否匹配、绑定到哪个 plot、绑定来源是什么。

该接口不写数据库，不修改 Dead Letter 状态。

## 3. 候选绑定人工确认

查看候选：

```bash
curl http://localhost:3000/api/v1/iot/devices/{id}/binding-candidates
```

确认绑定：

```bash
curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/confirm-binding-candidate \
  -H "Content-Type: application/json" \
  -d "{\"plotId\":\"field_or_plot_id\",\"source\":\"THINGSBOARD_RELATION\",\"remark\":\"人工确认 relation 对应此地块\"}"
```

确认后：

- 写入 `Device.fieldId`
- 设置 `Device.iotStatus = BOUND`
- 设置 `Device.bindingSource = MANUAL`
- 在 `Device.currentStatus.confirmedBindingCandidate` 中记录来源、备注和确认时间
- 写 OperationLog：`CONFIRM_DEVICE_BINDING_CANDIDATE`

## 4. MANUAL 绑定覆盖策略

如果当前设备已有 `bindingSource = MANUAL` 且已绑定其他地块，默认不允许覆盖，会返回冲突提示。

强制覆盖：

```bash
curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/confirm-binding-candidate \
  -H "Content-Type: application/json" \
  -d "{\"plotId\":\"field_or_plot_id\",\"source\":\"THINGSBOARD_RELATION\",\"remark\":\"人工确认覆盖\",\"force\":true}"
```

强制覆盖会写 OperationLog：`OVERRIDE_DEVICE_MANUAL_BINDING`。

## 5. Sync Audit JSON 导出

```bash
curl "http://localhost:3000/api/v1/iot/thingsboard/sync-audits/{id}/export?format=json"
```

当前只返回 JSON，不引入 Excel/CSV 依赖。

返回内容包括：

- audit 基本信息
- total / created / updated / bound / unbound
- warnings
- rawResult
- startedAt / finishedAt

后续可以扩展 CSV/Excel 导出。

## 6. Relation 半自动绑定审批流

ThingsBoard relation 不直接改变 AgriOS 设备绑定，只生成候选：

1. 调用 `GET /iot/devices/:id/binding-candidates` 查看候选。
2. 人工确认候选是否可信。
3. 调用 `POST /iot/devices/:id/confirm-binding-candidate` 执行绑定。
4. 如果覆盖已有 MANUAL 绑定，必须显式传 `force=true`。

候选 confidence 规则：

- attribute `agriosPlotId` / `plotId` 匹配 AgriOS Field：`HIGH`
- relation asset name 匹配 Field 名称：`MEDIUM`
- relation 只能找到 asset 但无法匹配 Field：`LOW`
- 当前 MANUAL 绑定与候选不同：作为 conflict warning 返回

## 7. PowerShell 示例

```powershell
curl http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/diff
curl http://localhost:3000/api/v1/iot/devices/{id}/binding-candidates
curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/confirm-binding-candidate `
  -H "Content-Type: application/json" `
  -d "{\"plotId\":\"field_or_plot_id\",\"source\":\"THINGSBOARD_RELATION\",\"remark\":\"人工确认 relation 对应此地块\"}"
curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/confirm-binding-candidate `
  -H "Content-Type: application/json" `
  -d "{\"plotId\":\"field_or_plot_id\",\"source\":\"THINGSBOARD_RELATION\",\"remark\":\"人工确认覆盖\",\"force\":true}"
curl "http://localhost:3000/api/v1/iot/thingsboard/sync-audits/{id}/export?format=json"
```

## 8. Windows CMD 示例

```cmd
curl http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/diff
curl http://localhost:3000/api/v1/iot/devices/{id}/binding-candidates
curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/confirm-binding-candidate ^
  -H "Content-Type: application/json" ^
  -d "{\"plotId\":\"field_or_plot_id\",\"source\":\"THINGSBOARD_RELATION\",\"remark\":\"人工确认 relation 对应此地块\"}"
curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/confirm-binding-candidate ^
  -H "Content-Type: application/json" ^
  -d "{\"plotId\":\"field_or_plot_id\",\"source\":\"THINGSBOARD_RELATION\",\"remark\":\"人工确认覆盖\",\"force\":true}"
curl "http://localhost:3000/api/v1/iot/thingsboard/sync-audits/{id}/export?format=json"
```
