# AgriOS Phase27 小菜园现场部署设计完成报告

完成日期：2026-08-03  
目标：不扩展业务功能，将 Phase19–26 的软件能力转化为普通施工人员可执行的小菜园施工、采购、电气、接入、试运行和验收体系，作为未来 300 亩基地的同标准缩小验证。

## 一、交付成果

### 1. 总体施工设计

`AGRIOS_GARDEN_DEPLOYMENT_DESIGN.md` 包含：

- AgriOS Cloud → MQTT → Edge Gateway → LoRa/Wi-Fi Node → Sensor/Valve/Pump 总体架构。
- 20 m × 12 m 参考场地、Zone A–D 平面定位图和坐标基准。
- 8 个土壤采样点、共享气象节点、四阀、泵、流量计、控制箱、太阳能和网关位置。
- 主管/支管、传感器埋设、控制箱、水泵、太阳能、天线施工要求。
- 设备编号、线缆表、施工顺序、强制停工点和红线交付物。

### 2. 正式采购 BOM

`AGRIOS_GARDEN_BOM.md` 覆盖边缘计算、工业网关、Raspberry Pi 替代、双运营商网络、LoRa、Wi-Fi、传感器、泵阀、流量/压力、太阳能、LiFePO4、箱体、防雷和安装辅材。

预算口径：

- 受控经济型：¥24,000–34,000。
- 推荐工程型：¥32,000–48,000。
- 含 10% 不可预见费：¥35,000–53,000。

以上为 2026-08-03 工程预算，不是供应商报价，不含人工、土建、运费和运营商费用。采购前要求正式询价及无线合规文件。

### 3. 电气接线设计

`AGRIOS_GARDEN_ELECTRICAL_DESIGN.md` 定义：

- PV → MPPT → 24 V LiFePO4 → DC 保护 → 分路负载单线图。
- 24 V 泵阀、12/5/3.3 V 控制供电、电流预算和保险原则。
- ESP32 → 光耦隔离 → 控制继电器 → DC 接触器/功率 MOS → 水泵的安全分级。
- 硬急停、低液位和过流回路不依赖云端。
- 端子排、I/O、反接、浪涌、感性负载、强弱电隔离、防水和上电步骤。

### 4. 设备接入

`AGRIOS_DEVICE_PROVISIONING_GUIDE.md` 覆盖设备生产、Device Key、标签、Tenant/Farm/Field/Zone 注册、一次性 Credential、传感器通道、LoRaWAN/Edge 映射、Telemetry、Command/Ack、TLS、凭据轮换和故障排查。

重要兼容结论：当前云端实际支持的主题为：

```text
agrios/{tenantId}/{deviceKey}/telemetry
agrios/{tenantId}/{deviceKey}/commands
agrios/{tenantId}/{deviceKey}/ack
```

用户要求的 Zone 语义主题被定义为 v2，但 Phase27 不改核心代码。现场应继续以 v1 接云；如 LoRa Network Server 输出 v2，必须由 Edge 做明确双向映射，禁止设备同时双发。

### 5. Day0–Day7 作业指导

`AGRIOS_FIELD_DAY1_INSTALLATION.md` 将试运行拆分为：设备准备、现场安装、传感器校准、首次自动灌溉、断网测试、异常恢复、数据分析和 Day7 验收，并定义人员配置、工具、放行条件、证据与每日收工要求。

### 6. 验收表

`AGRIOS_GARDEN_ACCEPTANCE_CHECKLIST.md` 提供可打印签字表，覆盖：

- 太阳能、电池、箱体、保护接地、急停。
- 网关、节点、RF、断网和补传。
- 传感器校准、时间、sequence 和 messageId。
- 泵、阀、管路、流量和超时保护。
- 设备注册、MQTT、遥测、自动灌溉、日报、Health Score 和诊断。
- Day1–Day7 指标表、遗留问题和五方签字。

## 二、架构与安全决策

- 小菜园按未来基地相同安全标准建设，只缩小数量和管路规模。
- 云端软件不能替代泵房硬联锁；ESP32 不直接带泵。
- 统一使用 24 VDC 常闭阀和默认断泵安全态。
- 一个 Field Pilot 只对应一个 Zone；灰度期间一次只运行一个 Zone。
- 真实用水量必须来自流量计增量 `waterVolumeLiters`，没有实测时日报返回 null。
- MQTT Credential 每设备唯一；二维码不含密码；Zone 绑定以 Registry 为准。
- 任何安全停工项失败都回退 MANUAL，不允许靠修改 Health Score 放行。

## 三、代码、模型和迁移影响

Phase27 未修改任何核心业务代码，也未新增设备配置/安装记录数据库模型。现有 Device、Sensor、Farm、Field、Zone、Telemetry、DeviceEvent、FieldPilot、FieldDailyReport 和 PilotDiagnostic 已满足小菜园施工验证，因此创建空 migration 会污染迁移历史且没有工程价值。

本阶段对数据库执行现有 migration deploy/状态验证和 Prisma schema validate；不产生无结构变化 migration。安装记录先使用签字表、红线图和设备台账，真实施工验证后再判断是否值得产品化。

## 四、验证结果

- 文档完整性：6 份任务文档及本报告全部存在，关键章节、主题、Day0–Day7、BOM 数量/规格/预算和验收项检查通过。
- MQTT 契约一致性：文档中的云端 v1 与 API、Mosquitto ACL 和 simulator 实现一致。
- API/Web/Simulator 单元测试：执行通过。
- 标准 E2E 与真实 MQTT E2E：执行通过。
- TypeScript lint、生产 build、Prisma validate：执行通过。
- PostgreSQL migration 状态：无待执行 migration。
- Docker API、PostgreSQL、Redis、Mosquitto：最终健康验证通过。

## 五、现场开工建议

施工前只需填写三个项目特定参数：真实场地尺寸/红线、泵铭牌与水力计算、当地太阳能/风荷载/无线合规。填写完成后从 `AGRIOS_FIELD_DAY1_INSTALLATION.md` 的 Day0 开始，不允许直接跳到自动灌溉。

Phase27 完成后下一步不是开发 Phase28 功能，而是按文档采购、台架预装、现场红线复核，并启动单 Zone 7 天 Field Pilot。只有 Day7 指标和全部安全签字通过，才允许扩展到 3 个 Zone。

