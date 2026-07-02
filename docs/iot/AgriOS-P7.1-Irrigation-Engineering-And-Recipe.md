# AgriOS P7.1 Irrigation Engineering And Recipe

P7.1 在 P7 决策闭环基础上增加专业灌溉工程能力，参考 Netafim / GrowSphere 类系统的产品思路，但本阶段只做后端基础能力，不引入重型仿真或 AI 图像模型。

本阶段不修改 ThingsBoard/Webhook 遥测接入逻辑，也不移除 P7 decision-engine API。

## 核心能力

- 灌溉设计：滴灌、喷灌、中心支轴、微喷。
- 设计分区：阀门、管长、管径、最大灌溉时长。
- BOM 生成：滴灌带、接头、阀门、过滤器、控制器、传感器。
- 简化水力校核：流量、压力损失、末端压力、流量偏差。
- 作物灌溉配方：不同作物、阶段、土壤的目标湿度区间。
- 湿润模拟：根据土壤类型和灌溉时长预估湿润范围、深渗风险。
- 决策引擎增强：优先使用作物配方阈值，硬编码 35/60 规则作为兜底。

## 主要接口

```text
POST  /api/v1/irrigation-designs
GET   /api/v1/irrigation-designs
GET   /api/v1/irrigation-designs/:id
PATCH /api/v1/irrigation-designs/:id
POST  /api/v1/irrigation-designs/:id/generate-bom
POST  /api/v1/irrigation-designs/:id/hydraulic-check

POST  /api/v1/crop-recipes
GET   /api/v1/crop-recipes
GET   /api/v1/crop-recipes/match?cropType=&cropStage=&soilType=
PATCH /api/v1/crop-recipes/:id

POST  /api/v1/wetting-simulations/run
```

## BOM 生成逻辑

简化规则：

- 滴灌带长度 = 面积平方米 / 毛管间距
- 滴头数量 = 滴灌带长度 / 滴头间距
- 阀门数量 = 分区数量
- 过滤器 = 1 套
- 控制器 = 1 台
- 传感器 = 分区数量

如果产品库 `IrrigationProduct` 中存在对应分类产品，并且有 `unitPrice`，系统会计算估算成本。

## 水力校核逻辑

简化规则：

- `requiredFlow = emitterCount * emitterFlowRate`
- `pressureLoss = pipeLength * simpleLossFactor * diameterFactor`
- `endPressure = sourceWaterPressure - pressureLoss`
- `flowVariation` 根据末端压力低于目标压力的比例估算

通过条件：

- `endPressure >= targetPressure`
- `flowVariation <= 20%`

可能警告：

- `LOW_END_PRESSURE`
- `HIGH_FLOW_VARIATION`
- `PIPE_DIAMETER_TOO_SMALL`
- `PUMP_CAPACITY_REQUIRED`

## 作物灌溉配方

配方用于替代固定阈值：

- `targetMoistureMin`
- `targetMoistureMax`
- `recommendedIrrigationMinutes`
- `maxDailyIrrigationMinutes`
- `fertigationAdvice`

决策引擎会先匹配 `cropType + cropStage + soilType`，没有匹配则回退到老规则：

- `soilMoisture < 35 => SHOULD_IRRIGATE`
- `soilMoisture > 60 => STOP_IRRIGATION`

## 湿润模拟

简化土壤规则：

- sandy / 砂土：下渗更深，表层湿润范围较小。
- loam / 壤土：湿润较均衡。
- clay / 黏土：表层扩散更大，深层下渗较慢。

输出：

- `surfaceWettingRange`
- `rootZoneWettingRange`
- `deepPercolationRisk`
- `expectedMoistureIncrease`
- `recommendedDuration`

## 决策闭环安全增强

生成灌溉 ActionPlan 时会加入工程安全检查：

- 单区最大灌溉分钟数。
- 单日地块最大灌溉分钟数。
- 深渗高风险阻断执行。
- 缺少阀门设备阻断执行。
- 缺少土壤湿度数据要求人工确认。

如果阻断：

- `ActionPlan.status = BLOCKED`
- `DecisionRecord.metadata.note` 写入阻断原因

如果需要人工确认：

- `ActionPlan.status = PENDING_APPROVAL`

## 与 Netafim / GrowSphere 风格系统的关系

P7.1 借鉴的是“工程设计 + 作物配方 + 水力校核 + 运行策略”的产品结构，而不是复制其商业产品或算法。AgriOS 当前实现是轻量、可解释、可落库的后端基础版，为后续专业模型、厂商产品库和地图设计工具预留接口。
