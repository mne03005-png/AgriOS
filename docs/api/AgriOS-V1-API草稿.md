# AgriOS V1 API 草稿

统一前缀：`/api/v1`

## CRUD 资源

- `users`
- `farms`
- `fields`
- `crop-seasons`
- `farm-inputs`
- `work-logs`
- `devices`
- `sensor-records`
- `irrigation-records`
- `service-providers`
- `cost-records`

每个资源预留基础接口：

- `POST /`
- `GET /`
- `GET /:id`
- `PATCH /:id`
- `DELETE /:id`

## MQTT 指令

`POST /api/v1/mqtt/commands`

```json
{
  "deviceId": "pump-001",
  "command": "PUMP_ON"
}
```
