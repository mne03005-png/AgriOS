# AgriOS V1 MQTT 协议

## Topic

设备上报：

```text
agrios/device/{deviceId}/telemetry
```

设备状态：

```text
agrios/device/{deviceId}/status
```

平台下发控制：

```text
agrios/device/{deviceId}/command
```

## Telemetry 示例

```json
{
  "soilMoisture": 32,
  "temperature": 25,
  "battery": 88,
  "timestamp": "2026-06-29T10:00:00Z"
}
```

## Status 示例

```json
{
  "online": true,
  "pumpStatus": "OFF",
  "valveStatus": "CLOSED"
}
```

## Command 示例

```json
{
  "command": "PUMP_ON"
}
```

```json
{
  "command": "PUMP_OFF"
}
```

## V1 自动灌溉规则

- 土壤湿度低于 35%，提醒或自动开泵。
- 土壤湿度高于 60%，自动关泵。
