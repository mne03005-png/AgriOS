# AgriOS V1 数据库设计

## 核心关系

```text
Farm
├── User
└── Field
    ├── CropSeason
    │   ├── FarmInput
    │   ├── WorkLog
    │   ├── IrrigationRecord
    │   └── CostRecord
    ├── Device
    └── SensorRecord

ServiceProvider 独立作为 V1 信息库。
```

## 设计原则

- Field 是平台核心对象，所有农田历史都围绕地块展开。
- CropSeason 表示一块地在某一年某一季的种植过程。
- 农资、农事、灌溉、成本优先挂到 CropSeason，便于后续按季核算。
- Device 可选挂到 Field，支持水泵、阀门、传感器、网关等设备。
- SensorRecord 同时关联 Device 和 Field，便于按设备和按地块查询。
- ServiceProvider 第一阶段独立，不参与交易。

## 核心模型

- User：用户、角色、手机号、所属农场。
- Farm：家庭农场、合作社或农业公司。
- Field：地块档案，含面积、位置、水源、灌溉方式、土地来源和轮作建议。
- CropSeason：作物、品种、年份、季节、播种和采收信息。
- FarmInput：投入品记录。
- WorkLog：农业作业记录。
- Device：田间设备。
- SensorRecord：传感器上报数据。
- IrrigationRecord：灌溉记录。
- ServiceProvider：服务人员和渠道信息。
- CostRecord：成本记录。
- IrrigationAdvice：灌溉建议记录，保存 MQTT 或系统规则生成的建议。
- OperationLog：操作日志，记录关键业务操作和追溯信息。

## 后续扩展字段

- CropSeason：产量、销售收入、利润、亩均收益。
- Field：GIS 边界、多边形坐标、土壤检测报告。
- WorkLog：任务状态、验收状态、服务订单 ID。
- Device：设备密钥、固件版本、安装位置、告警阈值。
- SensorRecord：批次号、原始 payload、数据质量标记。
- CostRecord：来源表类型、自动生成标记、审核状态。

## P3 留痕模型

### IrrigationAdvice

用于记录系统根据土壤湿度生成的灌溉建议。P3 不自动开泵，只生成建议并等待人工确认，避免农业现场出现误灌、过灌和设备误动作。

核心字段：

- fieldId：关联地块。
- deviceId：可选，关联触发建议的设备。
- cropSeasonId：可选，关联当前种植季。
- soilMoisture：触发规则时的土壤湿度。
- action：`SHOULD_IRRIGATE` / `NORMAL` / `STOP_IRRIGATION`。
- source：`MQTT` / `MANUAL_TEST` / `SYSTEM`。
- status：`PENDING` / `CONFIRMED` / `IGNORED` / `EXECUTED`。

### OperationLog

用于记录关键操作，支持后续追溯“谁在什么时候做了什么”。

P3 已记录：

- 创建地块。
- 创建种植季。
- 添加农资。
- 添加农事记录。
- 下发设备指令。
- 确认灌溉建议。
- 忽略灌溉建议。

### 自动成本

P3 只在创建时自动生成成本：

- FarmInput.totalPrice > 0 时生成 CostRecord。
- WorkLog.cost > 0 时生成 CostRecord。

更新 FarmInput 或 WorkLog 金额时暂不自动同步成本，后续应增加审核或冲正机制后再处理。

## P4 成本冲正

`CostRecord` 增加以下字段：

- sourceType：成本来源类型，如 `FARM_INPUT`、`WORK_LOG`。
- sourceId：来源记录 ID。
- isReversed：是否已冲正。
- reversedAt：冲正时间。
- reverseReason：冲正原因。

成本记录不直接删除。录入错误时使用冲正，保留历史，便于后续审计和账务追踪。成本汇总时排除 `isReversed = true` 的记录。

## P4 灌溉执行闭环

`IrrigationAdvice` 是系统建议，`IrrigationRecord` 是实际执行记录。

流程：

1. MQTT 上报土壤湿度。
2. 系统生成 `IrrigationAdvice`。
3. 人工确认后调用 execute。
4. 系统下发 MQTT 指令并创建 `IrrigationRecord`。
5. 灌溉完成后调用 finish，记录结束时间和用水量。

P4 仍不做全自动开泵，避免现场设备状态、阀门状态、管路故障和人工安全风险。

## P5 账号隔离与设备可靠性

### User.passwordHash

P5 增加 `User.passwordHash`，用于基础账号密码登录。密码使用哈希存储，不保存明文。

### 数据隔离

P5 使用 `Farm` 作为家庭农场、合作社或农业公司的组织主体。普通用户通过 JWT 中的 `farmId` 只能查看自己农场下的数据；`PLATFORM_ADMIN` 可查看全部。

当前是基础隔离，不做复杂 RBAC 和多组织成员关系。

### IrrigationRecord.status

灌溉记录增加状态：

- RUNNING：执行中。
- FINISHED：已完成。
- CANCELLED：已取消。
- FAILED：失败，预留。

灌溉建议 execute 后创建 `RUNNING` 记录；finish 后改为 `FINISHED`；cancel 后改为 `CANCELLED`。

### DeviceCommand

设备命令表用于记录 MQTT 指令下发和设备回执：

- PENDING：已创建，待发布。
- SENT：已发布到 MQTT。
- ACKED：设备已回执成功。
- FAILED：设备回执失败。
- TIMEOUT：预留超时状态。

P5 不做复杂超时任务，只预留状态和字段。
# P11 商业化 SaaS 数据模型增补

迁移名称：

```text
20260630001100_p11_commercial_saas_foundation
```

P11 为核心业务表增加 `tenantId` 字段，用于商业化多租户 SaaS 隔离。为保持历史数据兼容，当前新增字段为可空字段；正式上线前建议按农场和用户归属完成数据回填。

## 新增模型

### Tenant

租户主体，可表示公司、农场集团、合作社或家庭农场。

关键字段：

- `id`
- `name`
- `type`: `COMPANY` / `FARM_GROUP` / `COOPERATIVE` / `FAMILY_FARM`
- `status`: `ACTIVE` / `SUSPENDED` / `CLOSED`
- `contactName`
- `contactPhone`

### SubscriptionPlan

商业订阅套餐。

关键字段：

- `code`
- `name`
- `monthlyPrice`
- `includedDeviceCount`
- `includedAiDecisionCount`
- `metadata`

### BillingAccount

租户账务账户。

关键字段：

- `tenantId`
- `planCode`
- `status`
- `balance`
- `billingEmail`

### UsageRecord

用量计量记录。

关键字段：

- `tenantId`
- `farmId`
- `fieldId`
- `deviceId`
- `type`: `AI_DECISION` / `IRRIGATION_ACTION` / `DEVICE_EXECUTION` / `DEVICE_ONLINE_DAY` / `HECTARE_MONTH`
- `quantity`
- `amount`
- `occurredAt`

### Invoice

账单记录。

关键字段：

- `tenantId`
- `periodStart`
- `periodEnd`
- `totalAmount`
- `status`: `DRAFT` / `ISSUED` / `PAID` / `VOID`

### CostCenter

成本中心，用于后续把农场、地块、设备成本归集到商业统计口径。

### ApprovalRequest

人工审批请求，用于中高风险自动化动作。

关键字段：

- `tenantId`
- `requesterId`
- `approverId`
- `type`
- `targetType`
- `targetId`
- `status`: `PENDING` / `APPROVED` / `REJECTED` / `CANCELLED`

### SafetyAlert

安全告警。

关键字段：

- `tenantId`
- `fieldId`
- `deviceId`
- `severity`: `LOW` / `MEDIUM` / `HIGH` / `CRITICAL`
- `status`: `OPEN` / `ACKED` / `RESOLVED`

### DigitalTwinSnapshot

数字孪生快照，用于地块模拟、灌溉影响预览和后续产量估算。

关键字段：

- `tenantId`
- `fieldId`
- `soilState`
- `cropState`
- `prediction`

## 说明

- P11 暂不强制所有历史 CRUD 立刻按 `tenantId` 过滤，以避免破坏 P1-P7 已有流程。
- 新增 P11 模块优先读取请求上下文中的 `tenantId`。
- 后续生产化阶段应逐步把所有查询统一收口到租户过滤器或 Prisma 中间件。
