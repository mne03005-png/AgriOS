# AgriOS P12.2 ThingsBoard Installer Kit

P12.2 让 ThingsBoard 成为现场安装人员、设备调试人员和运维人员使用的设备机房。当前阶段不强依赖真实 ThingsBoard API，只提供规范、模板、验收模型和 AgriOS 绑定流程。

## 设备类型

`SOIL_SENSOR`, `PRESSURE_SENSOR`, `FLOW_METER`, `ELECTRIC_VALVE`, `PUMP_CONTROLLER`, `FERTIGATION_MACHINE`, `FERTILIZER_TANK`, `GATEWAY`, `WEATHER_STATION`, `CAMERA`.

## Device Profile 建议

- telemetry keys：见 `templates/thingsboard/device-profiles/*`
- attributes：`farmId`, `fieldId`, `zoneId`, `deviceCode`, `installerName`, `installDate`, `firmwareVersion`, `hardwareVersion`, `calibrationStatus`
- alarms：offline、low battery、low signal、pressure abnormal、flow abnormal
- RPC methods：`openValve`, `closeValve`, `setValveOpening`, `startPump`, `stopPump`, `setPumpFrequency`, `startFertigation`, `stopFertigation`, `emergencyStop`

RPC 只作为 ThingsBoard 云端控制兼容模式。真实生产推荐 Edge / PLC 控制。

## 安装验收

AgriOS 使用 `DeviceInstallationCheck` 记录 telemetry、signal、battery、RPC 测试和绑定状态。该记录用于证明设备现场验收，不等于直接控制设备。
