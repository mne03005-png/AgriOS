# AgriOS P12.1 Final IoT Architecture

ThingsBoard 是设备机房，AgriOS 是农业驾驶舱。

## 最终定位

- ThingsBoard：设备接入、遥测采集、原始数据看板、现场安装调试、设备验收、运维排障。
- AgriOS：农业业务系统、Mobile 驾驶舱、AI 分析、作业闭环、安全审批、报表和成本分析。

## 用户分工

- 农场老板：AgriOS Mobile。
- 农场操作员：AgriOS Mobile。
- 农艺师：AgriOS Admin / Reports。
- 安装人员：ThingsBoard App/Dashboard + 蓝牙工具。
- 运维人员：ThingsBoard + AgriOS Admin。
- 平台管理员：AgriOS Admin。

## 四条通道

- 遥测通道：ThingsBoard telemetry -> AgriOS normalizer -> 农业业务数据。
- 控制通道：AgriOS Safety -> Approval -> ActionQueue -> DeviceControl -> ThingsBoard / Edge / Bluetooth。
- 调试通道：安装人员通过 ThingsBoard 和蓝牙工具做现场调试。
- AI 分析通道：AgriOS 结合地块、作物、水肥、无人机、成本和遥测数据生成建议。

## 控制模式

- `THINGSBOARD_CLOUD`：云端 ThingsBoard RPC / Rule Chain。
- `EDGE_HTTP` / `PLC_GATEWAY`：现场 Edge / PLC 控制，生产优先。
- `BLUETOOTH_LOCAL`：近场调试和维护，不允许绕过权限。
- `MQTT_DIRECT`：AgriOS 直连 MQTT Broker。
- `MOCK`：Demo / 开发环境。

## 为什么不删除 ThingsBoard

ThingsBoard 设备接入成熟、国际认可、现场调试方便，能降低 AgriOS 早期 IoT 平台开发成本。

## 为什么普通用户不进 ThingsBoard

ThingsBoard 偏设备运维，普通农场用户只需要农业业务视图。AgriOS 避免暴露复杂设备参数，降低误操作风险。

## AI 数据流

```text
ThingsBoard telemetry
-> AgriOS telemetry normalizer
-> FieldStateSnapshot
-> CropRecipe / IrrigationDecision
-> AIRecommendation
-> AgriOS Mobile
```

## 控制安全边界

```text
AgriOS Mobile
-> Safety
-> Approval
-> ActionQueue
-> DeviceControl
-> ThingsBoard / Edge / Bluetooth
-> Feedback
-> ActionExecution
-> OperationReport
```

P12.2-P12.6 会继续增强安装验收、Edge、AI 分析、蓝牙维护和权限矩阵。
