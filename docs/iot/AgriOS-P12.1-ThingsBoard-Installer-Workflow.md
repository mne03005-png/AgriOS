# AgriOS P12.1 ThingsBoard Installer Workflow

ThingsBoard 用于设备接入、上线检查、遥测字段检查、原始曲线、现场调试、安装验收和运维排障。普通农场用户只看 AgriOS Mobile。

## 安装人员工作流

1. 在 ThingsBoard 创建设备。
2. 设置 access token。
3. 设备上电。
4. 检查 telemetry。
5. 检查 `signal / battery / pressure / flow / valveStatus`。
6. 确认设备在线。
7. 在 AgriOS 绑定 `farm / field / zone / device`。
8. 生成 `DeviceInstallationCheck` 安装验收记录。

## 命名规范

- `FARM-demo-FIELD-A-SOIL-001`
- `FARM-demo-FIELD-A-VALVE-001`
- `FARM-demo-PUMP-001`
- `FARM-demo-FERTIGATION-001`
- `FARM-demo-GATEWAY-001`

## 遥测字段

`soilMoisture`, `pressureKpa`, `flowRateM3h`, `valveStatus`, `valveOpeningPercent`, `pumpStatus`, `pumpFrequencyHz`, `fertilizerTankLevelL`, `batteryPercent`, `signalStrength`, `gatewayOnline`.

## 映射关系

- `thingsboardDeviceId`
- `agriosDeviceId`
- `farmId`
- `fieldId`
- `zoneId`

## 安全边界

ThingsBoard 是设备机房，AgriOS 是农业驾驶舱。控制动作必须经 AgriOS Safety / Approval / ActionQueue / DeviceControl。
