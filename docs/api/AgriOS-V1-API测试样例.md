# AgriOS V1 API 测试样例

默认地址：

```text
http://localhost:3000/api/v1
```

## 0. 注册、登录和当前用户

注册：

```bash
curl -X POST http://localhost:3000/api/v1/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"测试农户\",\"phone\":\"13800000000\",\"password\":\"123456\",\"role\":\"FARMER\",\"farmId\":\"seed-family-onion-farm\"}"
```

登录：

```bash
curl -X POST http://localhost:3000/api/v1/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"13800000000\",\"password\":\"123456\"}"
```

查询当前用户：

```bash
curl http://localhost:3000/api/v1/auth/profile ^
  -H "Authorization: Bearer <accessToken>"
```

P5 起优先使用 JWT 中的 `userId/farmId/role` 做操作日志和数据隔离；没有 JWT 时仍兼容 `x-user-id` 调试。

## 1. 创建农场

```bash
curl -X POST http://localhost:3000/api/v1/farms ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"家庭洋葱种植农场\",\"type\":\"FAMILY\"}"
```

记录返回的 `id`，后续用作 `farmId`。

## 2. 创建地块

```bash
curl -X POST http://localhost:3000/api/v1/fields ^
  -H "Content-Type: application/json" ^
  -d "{\"farmId\":\"<farmId>\",\"name\":\"洋葱地A\",\"areaMu\":300,\"landSource\":\"SELF\",\"lastYearCrop\":\"洋葱\",\"currentSuggestion\":\"不建议连续种植洋葱，建议轮作\"}"
```

## 3. 查询地块

```bash
curl http://localhost:3000/api/v1/fields
```

分页和关键词查询：

```bash
curl "http://localhost:3000/api/v1/fields?page=1&pageSize=20&keyword=洋葱"
```

## 4. 创建种植季

```bash
curl -X POST http://localhost:3000/api/v1/crop-seasons ^
  -H "Content-Type: application/json" ^
  -d "{\"fieldId\":\"<fieldId>\",\"cropName\":\"洋葱\",\"year\":2026,\"season\":\"spring\",\"status\":\"GROWING\"}"
```

## 5. 添加农资记录

```bash
curl -X POST http://localhost:3000/api/v1/farm-inputs ^
  -H "Content-Type: application/json" ^
  -d "{\"cropSeasonId\":\"<cropSeasonId>\",\"type\":\"FERTILIZER\",\"name\":\"复合肥\",\"brand\":\"样板品牌\",\"quantity\":20,\"unitPrice\":120,\"totalPrice\":2400,\"purchaseDate\":\"2026-02-01\"}"
```

## 6. 添加农事记录

```bash
curl -X POST http://localhost:3000/api/v1/work-logs ^
  -H "Content-Type: application/json" ^
  -d "{\"fieldId\":\"<fieldId>\",\"cropSeasonId\":\"<cropSeasonId>\",\"type\":\"FERTILIZING\",\"workDate\":\"2026-02-05\",\"workerName\":\"测试农户\",\"areaMu\":30,\"laborHours\":5,\"cost\":600,\"remark\":\"春季底肥\"}"
```

## 7. 添加设备

```bash
curl -X POST http://localhost:3000/api/v1/devices ^
  -H "Content-Type: application/json" ^
  -d "{\"fieldId\":\"<fieldId>\",\"code\":\"soil-002\",\"name\":\"洋葱地A土壤湿度传感器2\",\"type\":\"SOIL_SENSOR\",\"mqttTopic\":\"agrios/device/soil-002/telemetry\"}"
```

## 8. 添加传感器数据

```bash
curl -X POST http://localhost:3000/api/v1/sensor-records ^
  -H "Content-Type: application/json" ^
  -d "{\"deviceId\":\"<deviceId>\",\"fieldId\":\"<fieldId>\",\"type\":\"SOIL_MOISTURE\",\"value\":32,\"unit\":\"%\",\"reportedAt\":\"2026-06-29T10:00:00.000Z\"}"
```

## 9. 添加灌溉记录

```bash
curl -X POST http://localhost:3000/api/v1/irrigation-records ^
  -H "Content-Type: application/json" ^
  -d "{\"fieldId\":\"<fieldId>\",\"cropSeasonId\":\"<cropSeasonId>\",\"startTime\":\"2026-06-29T10:10:00.000Z\",\"endTime\":\"2026-06-29T11:00:00.000Z\",\"mode\":\"MANUAL\",\"waterAmount\":45,\"pumpDeviceId\":\"<pumpDeviceId>\",\"triggerReason\":\"土壤湿度低于35%\"}"
```

## 10. MQTT 指令下发

```bash
curl -X POST http://localhost:3000/api/v1/mqtt/commands ^
  -H "Content-Type: application/json" ^
  -d "{\"deviceId\":\"pump-001\",\"command\":\"PUMP_ON\"}"
```

## 11. 地块 Summary

```bash
curl http://localhost:3000/api/v1/fields/<fieldId>/summary
```

返回内容包括地块、当前种植季、最新土壤湿度、设备、最近灌溉、本季成本合计和轮作提醒。

## 12. 轮作提醒

```bash
curl http://localhost:3000/api/v1/fields/<fieldId>/rotation-advice
```

## 13. 成本汇总

```bash
curl http://localhost:3000/api/v1/cost-records/summary/by-season/<cropSeasonId>
```

## 14. 灌溉规则评估

```bash
curl -X POST http://localhost:3000/api/v1/irrigation-rules/evaluate ^
  -H "Content-Type: application/json" ^
  -d "{\"fieldId\":\"<fieldId>\",\"soilMoisture\":32}"
```

## 15. MQTT Telemetry 模拟

需要本地已启动 Mosquitto。示例使用 `mosquitto_pub`：

```bash
mosquitto_pub -h localhost -t agrios/device/soil-001/telemetry -m "{\"soilMoisture\":32,\"temperature\":25,\"battery\":88,\"timestamp\":\"2026-06-29T10:00:00.000Z\"}"
```

后端会写入 `SensorRecord`，并评估灌溉规则。第一版只记录建议，不自动开泵。

## 16. 通过设备接口下发指令

```bash
curl -X POST http://localhost:3000/api/v1/devices/<deviceId>/command ^
  -H "x-user-id: <userId>" ^
  -H "Content-Type: application/json" ^
  -d "{\"command\":\"PUMP_ON\"}"
```

```bash
curl -X POST http://localhost:3000/api/v1/devices/<deviceId>/command ^
  -H "x-user-id: <userId>" ^
  -H "Content-Type: application/json" ^
  -d "{\"command\":\"PUMP_OFF\"}"
```

查询设备命令和回执状态：

```bash
curl "http://localhost:3000/api/v1/device-commands?page=1&pageSize=20"
curl http://localhost:3000/api/v1/device-commands/<deviceCommandId>
```

模拟设备 ACK：

```bash
mosquitto_pub -h localhost -t agrios/device/pump-001/ack -m "{\"requestId\":\"<requestId>\",\"status\":\"ACKED\",\"message\":\"Pump started\"}"
```

## 17. 灌溉建议列表与处理

```bash
curl "http://localhost:3000/api/v1/irrigation-advices?page=1&pageSize=20&fieldId=<fieldId>"
```

确认建议：

```bash
curl -X PATCH http://localhost:3000/api/v1/irrigation-advices/<adviceId>/confirm
```

忽略建议：

```bash
curl -X PATCH http://localhost:3000/api/v1/irrigation-advices/<adviceId>/ignore
```

人工确认后执行建议：

```bash
curl -X PATCH http://localhost:3000/api/v1/irrigation-advices/<adviceId>/execute ^
  -H "x-user-id: <userId>" ^
  -H "Content-Type: application/json" ^
  -d "{\"pumpDeviceId\":\"<pumpDeviceId>\",\"valveDeviceId\":\"<valveDeviceId>\",\"command\":\"PUMP_ON\",\"remark\":\"人工确认后执行灌溉\"}"
```

## 18. 操作日志

```bash
curl "http://localhost:3000/api/v1/operation-logs?page=1&pageSize=20"
curl "http://localhost:3000/api/v1/operation-logs/by-field/<fieldId>?page=1&pageSize=20"
```

## 19. 地块时间线

```bash
curl "http://localhost:3000/api/v1/fields/<fieldId>/timeline?page=1&pageSize=20"
```

只看农事记录：

```bash
curl "http://localhost:3000/api/v1/fields/<fieldId>/timeline?page=1&pageSize=20&type=WORK_LOG"
```

只看成本记录：

```bash
curl "http://localhost:3000/api/v1/fields/<fieldId>/timeline?page=1&pageSize=20&type=COST_RECORD"
```

## 20. Swagger 文档

```text
http://localhost:3000/api/docs
```

## 21. 其他分页查询示例

```bash
curl "http://localhost:3000/api/v1/crop-seasons?page=1&pageSize=20&fieldId=<fieldId>"
curl "http://localhost:3000/api/v1/farm-inputs?page=1&pageSize=20&cropSeasonId=<cropSeasonId>"
curl "http://localhost:3000/api/v1/work-logs?page=1&pageSize=20&fieldId=<fieldId>&cropSeasonId=<cropSeasonId>"
curl "http://localhost:3000/api/v1/devices?page=1&pageSize=20&fieldId=<fieldId>"
curl "http://localhost:3000/api/v1/sensor-records?page=1&pageSize=20&fieldId=<fieldId>"
curl "http://localhost:3000/api/v1/irrigation-records?page=1&pageSize=20&fieldId=<fieldId>"
curl "http://localhost:3000/api/v1/cost-records?page=1&pageSize=20&cropSeasonId=<cropSeasonId>"
```

## 22. P3 自动成本说明

创建农资记录时，如果 `totalPrice > 0`，系统会自动生成一条 `CostRecord`。

创建农事记录时，如果 `cost > 0`，系统会自动生成一条 `CostRecord`。

P3 只在 create 时自动生成成本；后续更新农资或农事金额时暂不自动同步，避免误改历史账目。

## 23. 结束灌溉记录

```bash
curl -X PATCH http://localhost:3000/api/v1/irrigation-records/<irrigationRecordId>/finish ^
  -H "x-user-id: <userId>" ^
  -H "Content-Type: application/json" ^
  -d "{\"waterAmount\":1200,\"remark\":\"本次灌溉完成\"}"
```

如果灌溉记录关联了水泵设备，系统会下发 `PUMP_OFF`。

取消灌溉记录：

```bash
curl -X PATCH http://localhost:3000/api/v1/irrigation-records/<irrigationRecordId>/cancel ^
  -H "x-user-id: <userId>" ^
  -H "Content-Type: application/json" ^
  -d "{\"reason\":\"设备异常，取消本次灌溉\"}"
```

## 24. 成本冲正

```bash
curl -X PATCH http://localhost:3000/api/v1/cost-records/<costRecordId>/reverse ^
  -H "x-user-id: <userId>" ^
  -H "Content-Type: application/json" ^
  -d "{\"reason\":\"录入错误，成本作废\"}"
```

冲正不会删除成本记录，只会标记 `isReversed = true`。成本汇总会排除已冲正记录。

## 25. x-user-id 操作日志预留

当前不做登录鉴权。需要记录操作者时，在请求头加入：

```text
x-user-id: <userId>
```

系统会把该值写入 `OperationLog.userId`，后续可替换为 JWT 用户。

## 26. 成本报表

按地块：

```bash
curl http://localhost:3000/api/v1/reports/cost/by-field/<fieldId>
```

按农场：

```bash
curl http://localhost:3000/api/v1/reports/cost/by-farm/<farmId>
```

报表会排除已冲正成本。
# P11 商业化 SaaS 与安全执行 API 样例

以下接口默认前缀为 `http://localhost:3000/api/v1`。开发调试可通过请求头传入 `x-tenant-id`，JWT 接入后优先使用 JWT 内的租户和用户上下文。

## 创建租户

```bash
curl -X POST http://localhost:3000/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"寿光洋葱种植合作社\",\"type\":\"COOPERATIVE\",\"contactName\":\"王经理\",\"contactPhone\":\"13800000000\"}"
```

## 记录 AI 决策用量

```bash
curl -X POST http://localhost:3000/api/v1/billing/usage \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"tenant_001\",\"type\":\"AI_DECISION\",\"quantity\":1,\"farmId\":\"farm_001\",\"fieldId\":\"field_001\",\"amount\":0.12}"
```

## 生成 AI 农事建议

```bash
curl -X POST http://localhost:3000/api/v1/ai/decision/recommend \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant_001" \
  -d "{\"farmId\":\"farm_001\",\"fieldId\":\"field_001\",\"cropType\":\"洋葱\"}"
```

## 灌溉安全检查

```bash
curl -X POST http://localhost:3000/api/v1/safety/check \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant_001" \
  -d "{\"fieldId\":\"field_001\",\"durationMinutes\":30,\"plannedWaterAmount\":1200,\"soilMoisture\":32}"
```

## 创建审批请求

```bash
curl -X POST http://localhost:3000/api/v1/approval \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant_001" \
  -d "{\"type\":\"AUTO_IRRIGATION\",\"targetType\":\"ActionPlan\",\"targetId\":\"action_001\",\"reason\":\"自动灌溉执行前人工确认\"}"
```

## 执行设备动作

```bash
curl -X POST http://localhost:3000/api/v1/execution/run \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant_001" \
  -d "{\"mode\":\"ASSISTED\",\"fieldId\":\"field_001\",\"deviceId\":\"device_001\",\"command\":\"PUMP_ON\",\"durationMinutes\":30,\"plannedWaterAmount\":1200,\"soilMoisture\":32}"
```

## 停止灌溉设备

```bash
curl -X POST http://localhost:3000/api/v1/device-control/device_001/stop-irrigation \
  -H "Content-Type: application/json" \
  -d "{\"remark\":\"人工停止本次灌溉\"}"
```

## 地块数字孪生预览

```bash
curl -X POST http://localhost:3000/api/v1/digital-twin/fields/field_001/preview \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant_001" \
  -d "{\"irrigationMinutes\":30,\"waterAmount\":1200}"
```

## 农场 KPI

```bash
curl http://localhost:3000/api/v1/dashboard/farms/farm_001 \
  -H "x-tenant-id: tenant_001"
```

## 统一 IoT 适配层发送命令

```bash
curl -X POST http://localhost:3000/api/v1/iot/integration/command \
  -H "Content-Type: application/json" \
  -d "{\"adapter\":\"mock\",\"deviceId\":\"pump-001\",\"command\":\"PUMP_ON\",\"payload\":{\"duration\":30}}"
```

## 最近内部事件

```bash
curl http://localhost:3000/api/v1/event-bus/recent
```
