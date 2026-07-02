# ThingsBoard Webhook Rule Chain 配置步骤

本文用于 P6.2 本地联调：ThingsBoard 接收设备 telemetry 后，通过 Rule Chain Webhook 推送到 AgriOS。

## 1. 启动 ThingsBoard

```bash
cd infra/thingsboard
docker compose up -d
```

打开：

```text
http://localhost:8080
```

租户账号：

```text
tenant@thingsboard.org / tenant
```

## 2. 创建设备

在 ThingsBoard 控制台创建设备：

```text
soil_sensor_001
```

进入设备详情，复制 Access Token。

## 3. 模拟 MQTT 上报

ThingsBoard 本地 MQTT 端口使用 `18830`，避免和 AgriOS 自带 Mosquitto 的 `1883` 冲突。

Topic:

```text
v1/devices/me/telemetry
```

Payload:

```json
{
  "soilMoisture": 22,
  "temperature": 32,
  "humidity": 65,
  "battery": 88
}
```

## 4. 配置 Rule Chain Webhook

在 ThingsBoard Rule Chain 中创建 REST API Call / Webhook 节点。

URL:

```text
http://host.docker.internal:3000/api/v1/iot/thingsboard/telemetry
```

Method:

```text
POST
```

Header:

```text
x-thingsboard-secret: agrios_tb_secret
Content-Type: application/json
```

Body 示例：

```json
{
  "deviceName": "${deviceName}",
  "thingsboardDeviceId": "${deviceId}",
  "soilMoisture": "${soilMoisture}",
  "temperature": "${temperature}",
  "humidity": "${humidity}",
  "battery": "${battery}",
  "ts": "${ts}",
  "rawPayload": "${msg}"
}
```

如果 Rule Chain 的表达式语法与本地版本不同，可先使用固定 JSON 测试 Webhook 连通性：

```json
{
  "deviceName": "soil_sensor_001",
  "soilMoisture": 22,
  "temperature": 32,
  "humidity": 65,
  "battery": 88
}
```

## 5. AgriOS 检查

```bash
curl http://localhost:3000/api/v1/sensor-records
curl http://localhost:3000/api/v1/irrigation-advices
curl http://localhost:3000/api/v1/fields/{fieldId}/timeline
```

## 6. 常见问题

- `host.docker.internal` 无法访问：确认 AgriOS backend 在宿主机 `3000` 端口运行。
- `8080` 打不开：检查 ThingsBoard 容器是否启动完成。
- `18830` MQTT 不通：确认使用的是 ThingsBoard MQTT 端口，不是 AgriOS Mosquitto 的 `1883`。
- Webhook 返回 `401`：检查 `x-thingsboard-secret` 是否等于 `THINGSBOARD_WEBHOOK_SECRET`。
- 只写入 SensorRecord 但没有 IrrigationAdvice：确认 AgriOS Device 已绑定 Field，且 `soilMoisture < 35` 或 `soilMoisture > 60`。

P6.2 仍然不自动开泵。系统只生成灌溉建议，后续由人工确认执行。

## 7. P6.3 设备 Attributes 配置

可以在 ThingsBoard 设备 Attributes 中增加 AgriOS 归属字段，用于同步时自动识别设备归属。

推荐字段：

```json
{
  "agriosPlotId": "AgriOS Field ID",
  "plotId": "AgriOS Field ID",
  "agriosFarmId": "AgriOS Farm ID",
  "farmId": "AgriOS Farm ID",
  "deviceType": "SOIL_SENSOR",
  "cropType": "onion",
  "installLocation": "洋葱地A北侧",
  "latitude": 39.9042,
  "longitude": 116.4074,
  "thresholdSoilMoisture": 35,
  "remark": "P6.3 测试设备"
}
```

说明：

- `agriosPlotId` / `plotId` 会尝试绑定 AgriOS 地块。
- 如果 AgriOS 找不到该 Field，同步接口不会失败，只会返回 warning。
- 如果 attributes 中没有 plotId，不会清空已有手动绑定。

## 8. P6.3 推荐 Webhook Payload

Rule Chain Webhook 推荐发送：

```json
{
  "deviceName": "${deviceName}",
  "thingsboardDeviceId": "${deviceId}",
  "metadata": {
    "deviceName": "${deviceName}",
    "deviceId": "${deviceId}"
  },
  "values": {
    "soilMoisture": "${soilMoisture}",
    "temperature": "${temperature}",
    "humidity": "${humidity}",
    "battery": "${battery}"
  },
  "ts": "${ts}",
  "rawPayload": "${msg}"
}
```

Header 必须包含：

```text
x-thingsboard-secret: agrios_tb_secret
```

ThingsBoard Docker 容器访问宿主机 AgriOS backend 时，URL 使用：

```text
http://host.docker.internal:3000/api/v1/iot/thingsboard/telemetry
```
