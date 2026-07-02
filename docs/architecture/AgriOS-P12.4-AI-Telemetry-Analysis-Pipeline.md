# AgriOS P12.4 AI Telemetry Analysis Pipeline

AI 不直接放在 ThingsBoard。ThingsBoard 提供原始设备数据，AgriOS 结合农场、地块、作物、处方、水肥、无人机、成本做农业分析。

## 链路

```text
ThingsBoard telemetry
-> TelemetryNormalizer
-> DeviceTelemetrySnapshot
-> FieldStateSnapshot
-> CropRecipe
-> DecisionRecord
-> AIRecommendation
-> Mobile
```

## 输出

- 灌溉建议
- 水肥建议
- 压力/流量异常解释
- 设备风险
- 成本风险
- 无人机覆盖风险
- 作物健康提醒
- 产量影响因素

## 原则

每条建议必须有原因、证据数据、建议动作和风险等级。P12.4 只做规则型可解释建议，不接真实大模型 API，不做真实病虫害 AI，不做真实产量预测，不自动执行危险动作。
