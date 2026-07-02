# AgriOS P5 账号隔离与设备可靠性设计

## 目标

P5 让 AgriOS 具备基础账号登录、农场级数据隔离、灌溉执行状态、设备命令回执和成本报表能力。

## farmId 数据隔离

AgriOS 后续会服务多个家庭农场、合作社和县域服务主体。如果不按 `farmId` 隔离，多个农场的地块、设备、成本和农事记录会混在一起。

P5 采用基础规则：

- 普通用户只能查看自己 `farmId` 下的数据。
- `PLATFORM_ADMIN` 可以查看全部数据。
- 暂不做复杂 RBAC、权限矩阵和多组织关系。

## JWT 与 x-user-id

P5 新增 JWT 登录。请求携带 `Authorization: Bearer <token>` 时，系统从 token 中读取 `userId/farmId/role`。

为了兼容开发调试，仍支持 `x-user-id`。优先级是 JWT 高于 `x-user-id`。

## 灌溉记录状态机

灌溉建议仍然不会自动开泵。人工 execute 后才会下发 MQTT 指令并创建灌溉记录。

`IrrigationRecord.status`：

- RUNNING：灌溉执行中。
- FINISHED：灌溉完成。
- CANCELLED：人工或异常取消。
- FAILED：预留失败状态。

## DeviceCommand 回执机制

下发设备指令时，系统创建 `DeviceCommand` 并生成 `requestId`。MQTT payload 带上该 `requestId`。

设备回发：

```json
{
  "requestId": "...",
  "status": "ACKED",
  "message": "Pump started"
}
```

后端收到 `agrios/device/{deviceId}/ack` 后更新命令状态为 `ACKED` 或 `FAILED`，并写入操作日志。

## 成本报表

P5 新增按地块和按农场的成本汇总。报表会排除 `isReversed = true` 的成本记录。

## P5 不做

- 不做短信登录。
- 不做微信登录。
- 不做 refresh token。
- 不做复杂权限矩阵。
- 不做自动超时任务。
