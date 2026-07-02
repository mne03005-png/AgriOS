# AgriOS P4 灌溉执行闭环设计

## 目标

P4 把 P3 的“灌溉建议”推进到“人工确认后执行”，同时补齐工程稳定性、成本冲正和操作日志用户预留。

## 为什么不是全自动开泵

农业现场存在水泵空转、阀门未打开、管路破损、人工正在田间作业、传感器误报等风险。P4 采用“系统建议 -> 人工确认 -> 执行指令”的模式，既能形成闭环，又不把现场风险完全交给自动规则。

## IrrigationAdvice 与 IrrigationRecord

`IrrigationAdvice` 表示系统建议，例如“土壤湿度偏低，建议灌溉”。

`IrrigationRecord` 表示实际发生的灌溉过程。

执行流程：

1. MQTT telemetry 上报 `soilMoisture`。
2. 系统评估灌溉规则。
3. 需要处理时写入 `IrrigationAdvice`。
4. 人工调用 execute。
5. 系统下发 MQTT 指令并创建 `IrrigationRecord`。
6. 灌溉完成后调用 finish，写入结束时间和用水量。

## 成本为什么使用冲正

成本属于账务记录，不适合直接删除。直接删除会让历史统计无法追溯，也不利于后续合作社场景下的审核。

P4 使用冲正：

- 原记录保留。
- 标记 `isReversed = true`。
- 写入冲正时间和原因。
- 汇总时排除已冲正记录。

## x-user-id 预留

当前阶段不做 JWT 和复杂权限。P4 支持从请求头读取 `x-user-id` 并写入 `OperationLog.userId`。

后续接入 Auth/JWT 时，可以把该 helper 替换为真实登录用户，不需要重写业务日志逻辑。
