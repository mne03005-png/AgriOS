# AgriOS P6.2 ThingsBoard E2E Smoke

本文用于验证 ThingsBoard 到 AgriOS 的最小闭环：设备同步、地块绑定、遥测入库、灌溉建议生成、时间线可追溯。

## 1. 启动基础服务

启动 MySQL / Mosquitto：

```bash
docker compose up -d
```

启动 ThingsBoard：

```bash
cd infra/thingsboard
docker compose up -d
```

## 2. 启动 AgriOS backend

```bash
cd apps/backend
npx prisma migrate dev
npm run start:dev
```

## 3. 同步 ThingsBoard 设备

确保 `.env` 中配置：

```text
THINGSBOARD_BASE_URL=http://localhost:8080
THINGSBOARD_USERNAME=tenant@thingsboard.org
THINGSBOARD_PASSWORD=REPLACE_WITH_PASSWORD
THINGSBOARD_WEBHOOK_SECRET=REPLACE_WITH_RANDOM_SECRET
THINGSBOARD_SYNC_ENABLED=false
```

同步设备：

```bash
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/sync-devices
```

返回示例：

```json
{
  "created": 1,
  "updated": 0,
  "items": []
}
```

## 4. 绑定 AgriOS Field

查询设备：

```bash
curl http://localhost:3000/api/v1/iot/devices
```

绑定地块：

```bash
curl -X POST http://localhost:3000/api/v1/iot/devices/{deviceId}/bind-plot \
  -H "Content-Type: application/json" \
  -d "{\"plotId\":\"{fieldId}\"}"
```

## 5. 验证 Webhook

```bash
curl -X POST http://localhost:3000/api/v1/iot/thingsboard/telemetry \
  -H "Content-Type: application/json" \
  -H "x-thingsboard-secret: agrios_tb_secret" \
  -d "{\"deviceName\":\"soil_sensor_001\",\"soilMoisture\":22,\"temperature\":32,\"humidity\":65,\"battery\":88}"
```

预期：

```json
{
  "saved": true,
  "deviceMatched": true,
  "fieldBound": true,
  "adviceCreated": true
}
```

重复发送相同 `deviceName + ts + soilMoisture` 时，预期：

```json
{
  "saved": false,
  "duplicated": true
}
```

## 6. 检查数据

```bash
curl http://localhost:3000/api/v1/sensor-records
curl http://localhost:3000/api/v1/irrigation-advices
curl http://localhost:3000/api/v1/iot/devices/{deviceId}/health
curl http://localhost:3000/api/v1/fields/{fieldId}/timeline
```

## 7. 验证不自动开泵

P6.2 的设计边界是：

- ThingsBoard telemetry 自动写入 SensorRecord。
- 低湿度或高湿度自动生成 IrrigationAdvice。
- 不自动下发 `PUMP_ON` 或 `PUMP_OFF`。
- 后续仍通过人工确认和 execute 接口进入灌溉执行闭环。
