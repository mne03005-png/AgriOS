# AgriOS Phase28 野外无网络部署报告

> 完成日期：2026-08-03
> 范围：无光纤、无 Wi-Fi、无机房、无人值守、太阳能供电的 300 亩农业基地通信与能源设计。

## 1. 结论

Phase28 已形成可执行的野外部署基线：以 **LoRa + 4G/5G Industrial Gateway + Edge Offline + Solar** 为主架构，Cloud 负责用户、分析和 AI，Edge 负责本地缓存、安全规则和断网自治，Field Node 负责采集与执行。

本阶段不改动核心业务和 Prisma schema。现有 `EDGE_GATEWAY` Device 类型、Farm/Field/Zone 关系和 MQTT v1 接入能力可支撑首轮现场验证；独立 Gateway 数据表待真实部署确认“一场多网关、主备切换和资产字段”后再以兼容迁移引入，避免先验建模。

## 2. 已完成内容

### 2.1 网络与 Gateway 架构

- 建立 Cloud → MQTT/TLS → 4G/5G Gateway → Edge → LoRa → Sensor/Valve/Pump 架构。
- 定义逻辑关系 `Farm → Gateway → Field → Zone → Device`，并给出现有数据模型映射。
- 比较 Wi-Fi、LoRa、4G、NB-IoT 和卫星通信的覆盖、功耗、成本与适用范围。
- 推荐 300 亩基地采用主/备重叠覆盖的 LoRa + 双运营商 4G Gateway。
- 给出 Milesight、四信、有人、亿佰特，以及 SX1276/SX1262、ESP32/STM32、EC200/EC600 的采购前筛选基线。

### 2.2 Edge Offline

- 定义 NORMAL、OFFLINE、RECOVERING 状态机。
- 定义 SQLite 本地遥测缓存、优先级 offline queue、存储水位和数据保留策略。
- 定义安全本地规则边界、commandId 幂等重试、状态冲突处理和恢复补传次序。
- 使用 `deviceId + messageId` 作为端到端幂等键，实时流优先于历史补传，避免恢复风暴和重复上传。

### 2.3 太阳能系统

- 建立 PV → MPPT → LiFePO4 → DC Distribution → Gateway/Sensor 与独立 Pump 母线设计。
- 给出每日能耗、最差月光伏、电池自治容量的计算公式。
- 比较 100 W、200 W、300 W 方案；300 亩通信站建议从 300 W + 25.6 V 100 Ah 起步。
- 明确大功率泵站必须按扬程、流量和运行时长独立进行能源工程核算。
- 定义低 SOC 降级、泵启动闭锁、通信优先和 7 天能量平衡验收。

### 2.4 Gateway 模拟器

- 新增真实 MQTT QoS 1 Gateway 模拟器。
- 模拟 Gateway 上线、4G RSRP/RSRQ、LoRa 总/在线节点数、缓存深度和本地规则引擎状态。
- 支持定时断网、磁盘缓存、恢复补传、时间同步和一次性验证模式。
- 保持 MQTT v1 云端主题：`agrios/{tenant}/{device}/telemetry`；内部节点到 Gateway 链路不直接暴露公网。

### 2.5 施工与验收

- 小菜园文档新增 Wi-Fi 版本与 300 亩 LoRa + 4G 版本对比及迁移原则。
- 新增野外验收表，覆盖 4G、LoRa、MQTT、太阳能、电池、低电量、断网自治、补传去重、安全控制和 7 天长稳。

## 3. 修改文件

| 文件 | 内容 |
|---|---|
| `docs/AGRIOS_REMOTE_FIELD_NETWORK_DESIGN.md` | 野外网络、Gateway、通信选型与 MQTT 分层 |
| `docs/AGRIOS_EDGE_OFFLINE_MODE.md` | 离线缓存、本地规则、重试、恢复与幂等 |
| `docs/AGRIOS_SOLAR_POWER_DESIGN.md` | 太阳能、储能、保护、负载计算与降级策略 |
| `docs/AGRIOS_GARDEN_DEPLOYMENT_DESIGN.md` | 新增无固定网络部署变体 |
| `docs/AGRIOS_REMOTE_FIELD_ACCEPTANCE_CHECKLIST.md` | 野外现场验收表 |
| `tools/device-simulator/src/gateway-simulator.mjs` | Gateway MQTT/断网/恢复模拟器 |
| `tools/device-simulator/test/gateway-simulator.test.mjs` | Gateway 状态、遥测和配置测试 |
| `tools/device-simulator/package.json` | Gateway 启动和语法检查脚本 |
| `tools/device-simulator/README.md` | 使用说明 |
| `apps/api/test/agrios-flow.e2e-spec.ts` | 真实凭据 + Mosquitto + API 的 Gateway E2E |

## 4. 验证结果

| 检查 | 结果 |
|---|---|
| API 单元测试 | 17 suites / 52 tests 全部通过 |
| Web 测试 | 5/5 通过 |
| Device/Gateway Simulator | 10/10 通过 |
| 常规 API E2E | 12/12 通过（AgriOS live 套件按设计跳过） |
| AgriOS 真实 MQTT E2E | 8/8 通过，包含 Gateway 动态凭据、QoS 1 上传和 API 查询 |
| 全仓 lint/typecheck | 通过 |
| 数据库/API/Web production build | 通过；Web 19 个页面生成成功 |
| Prisma validate | 通过 |
| Migration status | 9 个迁移，数据库已是最新；本阶段无 schema 变更，未生成空迁移 |

说明：`pnpm test:e2e` 首次使用默认测试密码连接当前 Docker 随机密钥数据库时等待超时；显式使用当前容器数据库凭据后，常规 E2E 12/12 通过。该问题属于本机测试环境凭据，不是代码断言失败。

## 5. 现场实施边界

- 文档中的价格是 2026 年采购预算区间，不是报价；采购必须确认 CN470、运营商频段、协议类型、IP 等级和本地认证。
- RF 覆盖不能按宣传距离验收，必须在成熟作物高度、边界/低洼点和最差天气条件下做 RSSI/SNR 测绘。
- 远程完全失联时无法“实时远程查看”，但 Edge 会继续采集、按批准的安全规则运行、现场告警和缓存；网络恢复后补传与云端告警恢复。
- 泵、配电、防雷和光伏结构须由具备当地资质的专业人员复核施工。

## 6. 下一阶段建议

1. 采购 1 台 CN470 工业 Gateway、2 种 LoRa 节点和双运营商 SIM，完成台架互操作测试。
2. 在单 Zone 执行 72 h 断网缓存 + 限速补传试验，确认数据库容量和恢复时长。
3. 现场测量 Gateway/4G/泵的 24 h 实际功耗，用最差月辐照重算 PV 与电池。
4. 完成成熟作物高度 RF 勘测后再决定一主一备网关位置及是否需要中继。
5. 只有现场数据证明现有 Device 映射不足时，才引入独立 Gateway/安装记录 schema 和迁移。
