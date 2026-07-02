# AgriOS P6.4 Webhook Retry And Sync Audit

P6.4 增强 ThingsBoard webhook 运维能力：Dead Letter 单条 retry、设备同步审计、设备归属优先级固化，以及 webhook 重放防重复。

## 1. P6.4 目标

- 支持手动 retry 单条 `IoTWebhookDeadLetter`。
- `sync-devices` 每次执行写入 `IoTSyncAudit`。
- 固化 ThingsBoard 设备与 AgriOS Farm/Field 的归属策略。
- Webhook 重放时避免重复写遥测和重复生成灌溉建议。

P6.4 仍然不做前端、不自动开泵、不自动开阀、不复制 ThingsBoard 源码。

## 2. Dead Letter retry

查询 Dead Letter：

```bash
curl http://localhost:3000/api/v1/iot/webhook-dead-letters
```

按状态查询：

```bash
curl "http://localhost:3000/api/v1/iot/webhook-dead-letters?status=PENDING&page=1&pageSize=20"
```

重试单条：

```bash
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/retry
```

retry 逻辑：

- 根据 `id` 查询 `IoTWebhookDeadLetter`。
- `RESOLVED` 状态拒绝 retry。
- 使用 `rawPayload` 调用内部 telemetry replay，不再次校验 `x-thingsboard-secret`。
- 成功或识别为重复 telemetry 时，状态改为 `RESOLVED`。
- 失败时 `retryCount + 1`，状态改为 `RETRIED`，并更新错误信息。
- 不做自动 retry 任务，避免异常数据无限重放。

## 3. Sync Audit

每次调用：

```bash
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/sync-devices
```

都会写一条 `IoTSyncAudit`，记录：

- `total`
- `created`
- `updated`
- `bound`
- `unbound`
- `warnings`
- `rawResult`
- `startedAt`
- `finishedAt`

查询同步审计：

```bash
curl http://localhost:3000/api/v1/iot/thingsboard/sync-audits
curl "http://localhost:3000/api/v1/iot/thingsboard/sync-audits?syncType=devices&page=1&pageSize=20"
```

## 4. 设备归属优先级

P6.4 固化设备归属优先级：

1. AgriOS 手动绑定的 `plotId` 优先级最高。
2. ThingsBoard attribute `agriosPlotId` 次之。
3. ThingsBoard attribute `plotId` 再次。
4. ThingsBoard asset relation 只作为候选信息，不自动覆盖手动绑定。
5. 空属性永远不清空已有绑定。
6. 找不到 Field/Plot 时不报错，只返回 warning。
7. attribute 指向新 plotId 时：
   - 当前设备没有手动绑定，可以自动绑定。
   - 当前设备已有手动绑定，不自动覆盖，只记录 conflict warning。

`Device.bindingSource` 可选值：

- `MANUAL`
- `THINGSBOARD_ATTRIBUTE`
- `THINGSBOARD_RELATION`
- `UNKNOWN`

手动绑定接口会设置 `bindingSource = MANUAL`：

```bash
curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/bind-plot \
  -H "Content-Type: application/json" \
  -d "{\"plotId\":\"field_or_plot_id\"}"
```

解绑接口会清空 field，并设置 `bindingSource = UNKNOWN`：

```bash
curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/unbind-plot
```

## 5. Webhook 重放防重复

重放时复用 P6.3 的去重逻辑：

- 相同 `deviceName / thingsboardDeviceId + recordedAt + soilMoisture` 的 telemetry 不重复创建 `SensorRecord`。
- 同一地块 30 分钟内已有相同 action 的 `PENDING` IrrigationAdvice，不重复生成。
- 返回中包含：
  - `duplicatedTelemetry`
  - `irrigationAdviceCreated`
  - `skippedReason`

## 6. Windows CMD 示例

```cmd
curl http://localhost:3000/api/v1/iot/webhook-dead-letters
curl "http://localhost:3000/api/v1/iot/webhook-dead-letters?status=PENDING&page=1&pageSize=20"
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/retry
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/mark-resolved
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/sync-devices
curl http://localhost:3000/api/v1/iot/thingsboard/sync-audits
curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/unbind-plot
```

## 7. PowerShell 示例

```powershell
curl http://localhost:3000/api/v1/iot/webhook-dead-letters
curl "http://localhost:3000/api/v1/iot/webhook-dead-letters?status=PENDING&page=1&pageSize=20"
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/retry
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/mark-resolved
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/sync-devices
curl http://localhost:3000/api/v1/iot/thingsboard/sync-audits
curl -X POST http://localhost:3000/api/v1/iot/devices/{id}/unbind-plot
```

## 8. 为什么不自动 retry

农业现场系统需要避免异常数据被无限重放，尤其不能让错误遥测间接触发重复灌溉建议或误导人工判断。P6.4 只做人工可控的单条 retry，为后续 P6.5/P7 的重试队列和审计后台预留基础。

## 9. 仍然不自动开泵/开阀

P6.4 只处理数据接入和运维留痕。即使重放低湿度 telemetry，也只可能生成灌溉建议，不会自动下发 `PUMP_ON` 或开阀命令。
