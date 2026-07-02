# AgriOS P6.3 ThingsBoard Asset And Health

P6.3 目标是增强 AgriOS 与 ThingsBoard 的设备归属识别、设备在线状态巡检、Webhook 异常留痕能力。

## 1. P6.3 边界

- AgriOS 仍然负责农业业务、地块、种植季、灌溉建议和业务留痕。
- ThingsBoard 负责设备接入、遥测、设备属性和资产关系。
- 不复制 ThingsBoard 源码。
- 不做前端页面。
- 不自动开泵。
- 不自动开阀。

## 2. ThingsBoard 属性映射字段

设备同步时会读取 ThingsBoard `SERVER_SCOPE`、`SHARED_SCOPE`、`CLIENT_SCOPE` attributes，并映射常见字段：

| ThingsBoard Attribute | AgriOS 用途 |
| --- | --- |
| `agriosTenantId` | 预留租户归属 |
| `agriosFarmId` / `farmId` | 预留农场归属 |
| `agriosPlotId` / `plotId` | 尝试绑定 AgriOS Field |
| `cropType` | 保存到 `Device.currentStatus.thingsboardAttributes` |
| `deviceType` | 尝试映射 `Device.type` |
| `installLocation` | 保存到 `Device.currentStatus` |
| `latitude` / `longitude` | 保存到 `Device.currentStatus` |
| `thresholdSoilMoisture` | 保存到 `Device.currentStatus` |
| `remark` | 同步到 `Device.remark` |

如果 attributes 里没有 `plotId`，不会清空已有手动绑定。

如果 attributes 里配置了 `plotId`，但 AgriOS 找不到对应 Field，同步不会失败，只会在 `warnings` 中返回提示。

## 3. 设备在线状态判断

手动巡检接口：

```bash
curl -X POST http://localhost:3000/api/v1/iot/devices/check-health
```

判断规则：

- `lastTelemetryAt` 在 `IOT_DEVICE_OFFLINE_MINUTES` 分钟内：`ONLINE`
- 超过阈值或没有遥测时间：`OFFLINE`
- `DISABLED` 设备不改状态
- 默认阈值：`10` 分钟

环境变量：

```text
IOT_DEVICE_OFFLINE_MINUTES=10
```

返回示例：

```json
{
  "checked": 12,
  "online": 8,
  "offline": 4,
  "disabled": 0,
  "updated": 4
}
```

## 4. Dead Letter 机制

Webhook 通过 secret 校验后，如果出现以下情况，会记录 `IoTWebhookDeadLetter`：

- payload 归一化失败
- 遥测字段无法转换为有效数字，并且没有任何可保存指标
- SensorRecord 写入失败
- 灌溉建议评估或创建失败

Secret 校验失败直接返回 `401`，默认不写 Dead Letter，避免恶意请求刷库。

查询 Dead Letter：

```bash
curl http://localhost:3000/api/v1/iot/webhook-dead-letters
```

标记已处理：

```bash
curl -X POST http://localhost:3000/api/v1/iot/webhook-dead-letters/{id}/mark-resolved \
  -H "Content-Type: application/json" \
  -d "{\"remark\":\"已确认是测试异常数据\"}"
```

P6.3 不做自动重试任务，只保留 `retryCount` 和状态字段，给后续 P6.4/P7 使用。

## 5. 测试命令

同步 ThingsBoard 设备：

```bash
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/sync-devices
```

查询 ThingsBoard assets：

```bash
curl http://localhost:3000/api/v1/iot/thingsboard/assets
```

正常遥测：

```cmd
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/telemetry ^
  -H "Content-Type: application/json" ^
  -H "x-thingsboard-secret: agrios_tb_secret" ^
  -d "{\"deviceName\":\"soil_sensor_001\",\"soilMoisture\":22,\"temperature\":32,\"humidity\":65,\"battery\":88,\"ts\":1782780000000}"
```

PowerShell 正常遥测：

```powershell
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/telemetry `
  -H "Content-Type: application/json" `
  -H "x-thingsboard-secret: agrios_tb_secret" `
  -d "{\"deviceName\":\"soil_sensor_001\",\"soilMoisture\":22,\"temperature\":32,\"humidity\":65,\"battery\":88,\"ts\":1782780000000}"
```

异常遥测，用于测试 Dead Letter：

```cmd
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/telemetry ^
  -H "Content-Type: application/json" ^
  -H "x-thingsboard-secret: agrios_tb_secret" ^
  -d "{\"deviceName\":\"soil_sensor_001\",\"soilMoisture\":\"bad-number\",\"temperature\":\"abc\",\"ts\":\"bad-ts\"}"
```

PowerShell 异常遥测：

```powershell
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/telemetry `
  -H "Content-Type: application/json" `
  -H "x-thingsboard-secret: agrios_tb_secret" `
  -d "{\"deviceName\":\"soil_sensor_001\",\"soilMoisture\":\"bad-number\",\"temperature\":\"abc\",\"ts\":\"bad-ts\"}"
```

## 6. 仍然不自动开泵

P6.3 即使收到低土壤湿度 telemetry，也只生成 IrrigationAdvice。是否执行灌溉仍由人工确认，后续通过灌溉建议 execute 接口进入执行闭环。
