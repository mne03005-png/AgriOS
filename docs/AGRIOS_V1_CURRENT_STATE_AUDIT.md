# AgriOS V1.0 当前状态审计

## 1. 审计边界与结论

审计时间 2026-08-06（Asia/Shanghai），分支 `main`，HEAD 与 `origin/main` 均为 `d382ce95ee1244a403b1753b104705d1a79ce317`。审计覆盖 `apps/backend`、`apps/mobile`、`apps/web-admin`、`apps/miniapp`、`packages`、Prisma、docs、infra、integrations、scripts、Compose、Nginx、MQTT、ThingsBoard、测试、migration 和未提交修改。

基于源码和静态验证的保守估算：整体真实完成度 **35%**，云端 **55%**，正式移动产品 **35%**，IoT 软件 **40%**，真实设备控制 **10%**，现场运行 **0%**。这是范围加权审计值，不是代码行覆盖率；文档、Mock、模拟器和未验收硬件未计作 REAL。

状态词仅使用：REAL、MOCK、UI_ONLY、API_ONLY、DESIGN_ONLY、PARTIAL、BLOCKED_BY_HARDWARE、BLOCKED_BY_CONFIG、CONFLICTING、OBSOLETE、UNKNOWN。

## 2. 工作区与工具基线

- 初始工作区：14 个已修改文件、1 个未跟踪 refresh DTO，加上 gray、宝塔、integrations、Phase5/6 脚本和 `backups/`；`git diff --stat` 为 14 files / 228 insertions / 47 deletions。
- 最近提交：`d382ce9` Docker production；此前是 Phase 30/29/28/27 文档/设计提交。
- Node `v24.18.0`，npm `11.16.0`，Docker `29.6.1`，Compose `v5.3.0`。
- 未执行 reset/clean/stash/checkout/commit/push/merge；未读取或打印 secret 内容，未连接数据库、未启服务、未控制设备。
- 本审计只新增六份交付物并对 `.gitignore` 增加 backups、导出 SQL、证书/私钥保护；Prisma migration SQL 保持例外可跟踪。

## 3. 前端清单

唯一有实现的前端是 `apps/mobile`（Vue 3/Vite）；`apps/web-admin/README.md` 与 `apps/miniapp/README.md` 是空壳。路由证据：`apps/mobile/src/router/index.ts`；HTTP fallback：`apps/mobile/src/api/http.ts:24-59`；Mock 数据：`apps/mobile/src/api/mock-data.ts`；导航：`AppTabBar.vue`；无 manifest/service worker，PWA/正式离线能力为 DESIGN_ONLY。

| 页面/路由 | 状态 | API/证据与缺失 |
|---|---|---|
| Cockpit `/cockpit` | MOCK | `/mobile/cockpit`；初始化 `mockCockpit`，失败自动 fallback |
| Map `/map` | MOCK | `/mobile/map`、GIS APIs；地图 provider 默认 mock，三种 SDK adapter 仍继承 Mock |
| Operations `/operations` | MOCK | `/mobile/operations`；Demo 作业 fallback |
| AI `/ai` | PARTIAL | recommendations API 存在；无模型服务/真实验收证据 |
| Profile `/profile` | PARTIAL | Auth API；角色和会话策略未完成 |
| Login `/login` | PARTIAL | `/auth/login`；仅生产域名路由守卫，默认 Demo 用户 |
| Change password `/change-password` | PARTIAL | `/auth/change-password`；缺 UI 自动安全测试 |
| Installer checks `/installer-checks` | PARTIAL | `/installer/device-checks`；缺附件/签字/硬件验收 |
| Edge gateways `/edge-gateways` | API_ONLY | Edge API/DB 存在但无真实 Agent |
| Bluetooth maintenance | BLOCKED_BY_HARDWARE | API/UI 存在，缺设备与现场验证 |
| Device integration | PARTIAL | 多个生产 API，但明确存在 fallback |
| Read-only devices `/devices` | PARTIAL | IoT telemetry API；前端角色判断依赖 localStorage |
| Valve control test | MOCK | 页面明确安全模拟；无真实泵阀结论 |
| Showcase `/showcase` | MOCK | 展示入口，不属于正式 V1 |
| Field detail | MOCK | `/mobile/fields/:id/detail`，默认 demo field |
| Alerts | PARTIAL | `/mobile/alerts`；后端聚合存在，缺正式告警闭环 |
| Reports | MOCK | `/mobile/reports/summary`，fallback 报告 |
| Demo status | MOCK | `/demo/health`；本身是 Demo 检查页 |
| Operation report detail | MOCK | `/operation-reports/:id`，fallback 数据 |
| Drone operations/review | MOCK | API+DB 广泛，但前端自动 fallback；V1 停止复杂无人机范围 |
| Boundary review | PARTIAL | GIS boundary API/DB；真实坐标/现场验收缺失 |

适配性：CSS 是移动优先并有部分响应式布局，手机 PARTIAL；平板 PARTIAL；电脑没有专用工程/超级管理员工作台，为 UI_ONLY。危险操作有 Valve 测试文案/控件，但缺统一 re-auth、权限、审批、幂等和硬件反馈门禁，故 PARTIAL。

## 4. 后端与 API 清单

Nest `AppModule` 实际引入 55 个模块目录；共 58 个 controller、85 个 service、4 个 guard、75 个 Prisma model、19 个 migration。所有 controller 路由均可由 `@Controller` 和 HTTP decorator 静态生成；主要能力如下。DTO 分布于各模块 `dto/`，全局校验见 `main.ts`；Tenant/Permissions/JWT guards 位于 `src/common` 与 `modules/auth`。

| 状态 | 模块（路径均为 `apps/backend/src/modules/<name>`） | 证据/缺失 |
|---|---|---|
| PARTIAL | auth, user, tenant, audit | JWT、刷新令牌本地修改、Tenant middleware/guard、AuditEvent；五角色映射和越权回归不足 |
| PARTIAL | farm, field, crop-season, farm-input, work-log, farm-activity, cost, operation-cost/log/report, report | Controller/Service/Prisma 均有；Zone 无独立主模型，业务链未做真实用户验收 |
| PARTIAL | device, device-command, sensor-record, dashboard, alert(由 mobile/safety 聚合), health | 数据持久化存在；配置/设备/运维证据不足 |
| CONFLICTING | action-queue, execution, decision-engine, device-control | BullMQ+memory、多个执行入口和 adapter；需唯一消费者/网关 |
| PARTIAL | approval, safety, irrigation, irrigation-advice/design/monitoring/rotation/rule, fertigation, crop-recipe, wetting-simulation | 丰富 API/表；PLC 硬安全和真实灌溉均未验收 |
| BLOCKED_BY_CONFIG | iot, mqtt | MQTT 仅 `MQTT_DIRECT && !dryRun` 连接；ThingsBoard 缺配置时抛不可用；需 TLS/ACL/真实数据 |
| BLOCKED_BY_HARDWARE | edge-gateway, installer, bluetooth | 云端 API/模型已存在；没有可部署 Edge Agent 或设备台架证据 |
| MOCK | demo, ai-decision | Demo/规则型建议；不能视为真实 AI |
| PARTIAL | ai-recommendation, digital-twin, crop-health, yield-analysis | 服务/表/API 存在；真实模型/数据/验收不足 |
| PARTIAL | gis | boundary/GPS/layer API 与表；地图 SDK 仍 Mock |
| OBSOLETE（V1） | billing, drone-operation, drone-review | 有大量实现但超出收敛后的首期范围，关闭正式入口而非本阶段删除 |
| PARTIAL | event-bus, file-security, service-provider, mobile | 内部事件、文件检查、聚合 API；缺系统测试/正式入口证明 |

API 安全证据：全局前缀 `/api/v1`，Swagger/ValidationPipe 见 `main.ts`；认证/权限是否覆盖每条 controller 尚未形成可执行矩阵，故不得整体标 REAL。

## 5. 数据库清单

Schema：`apps/backend/prisma/schema.prisma`；19 个 migration 位于 `prisma/migrations`。75 个模型按领域为：

- 身份/租户/商业：User, Tenant, TenantFarm, SubscriptionPlan, BillingAccount, UsageRecord, Invoice。
- 农业业务：Farm, Field, CropSeason, FarmInput, WorkLog, CostRecord/Center, OperationCost/Log/Report, FarmActivity, ServiceProvider。
- IoT/控制：Device, SensorRecord, DeviceTelemetrySnapshot, DeviceCommand, IrrigationRecord/Advice, ActionPlan/Execution/QueueJob, EdgeGateway/Binding/Command, DeviceInstallationCheck, BluetoothSession/OperationLog。
- 安全/决策：ApprovalRequest, SafetyAlert/Policy, AutoExecutionPolicy, FieldStateSnapshot, DecisionRecord, DigitalTwinSnapshot, EventLog, AuditEvent, AIRecommendation。
- 灌溉/水肥：IrrigationDesign/Zone/Product/BOM/BOMItem, HydraulicCheckResult, CropIrrigationRecipe, WettingSimulation, RotationGroup/Valve/Schedule/Run, AnomalyRule/Event, FertilizerTank, FertigationRecipe/Task, DissolveFertilizerTask。
- GIS/无人机/分析：FieldBoundary, GpsTrack, DroneMapJob/Operation/ImportJob/Review, MapLayer, AIRecognitionJob, CropHealthObservation, YieldRecord/Factor。
- IoT 集成：IoTWebhookDeadLetter, IoTSyncAudit。

多数业务表有 `tenantId` 和索引，但许多为可空 String，且外键关系/数据库级租户约束不统一，状态 PARTIAL。遥测有 `[deviceId, reportedAt]` 索引、snapshot 对 device 唯一，但 SensorRecord 未见明确消息 ID 唯一约束，去重 PARTIAL。ActionQueueJob 未见全局业务幂等唯一键，EdgeCommand 也需明确 commandId 唯一约束。灌溉、农事、安装、审计均有模型；刷新令牌 DTO/逻辑正在本地修改但 Schema 无独立 RefreshToken 模型证据；通用 Attachment 模型缺失；IntegrationConfig 模型缺失。这三项分别为 PARTIAL/API_ONLY、DESIGN_ONLY、DESIGN_ONLY。

## 6. IoT、集成和部署

| 项目 | 状态 | 证据与阻断 |
|---|---|---|
| Mosquitto MQTT TLS | BLOCKED_BY_CONFIG | production compose、`infra/mosquitto`、`MqttService`；缺 secret/证书/ACL 验证 |
| MQTT Direct | PARTIAL | telemetry/status/ack 订阅与 command publish；缺真实设备合同测试 |
| ThingsBoard | BLOCKED_BY_CONFIG | Client/Webhook/sync/dead-letter 完整度较高；外部配置和边界未锁定 |
| Edge | BLOCKED_BY_HARDWARE | Gateway/Binding/Command 云模型；无独立可部署 Agent |
| PLC/泵阀 | BLOCKED_BY_HARDWARE | 多 adapter 和安全开关；没有 PLC 程序/接线/台架报告 |
| QGIS/QField | PARTIAL | GIS API/GeoJSON；无正式交换验收 |
| integrations/hiveeyes | OBSOLETE（V1） | 未跟踪的第三方源码镜像，不应当作已集成能力 |
| PM2 | CONFLICTING | `ecosystem.config.cjs` 指向旧主机路径，与 Docker 双运行风险 |
| Docker production | PARTIAL | 完整服务定义；静态配置被必填 secret 阻断 |
| Docker gray | PARTIAL | 安全覆盖文件；单独无 image/build，叠加仍缺 image tag/secrets |
| MySQL/Redis/Mosquitto | CONFLICTING | production 内置；需确认服务器没有旧 PM2/容器实例，本阶段未连服务器 |
| Nginx/宝塔 | CONFLICTING | `infra/nginx/agrios.conf` 与未跟踪 `baota/` 两套入口需收敛 |
| 备份/恢复/回滚 | PARTIAL | ops/deploy 脚本存在；未执行真实恢复/切换 |
| 日志/监控 | PARTIAL | JSON 日志轮转/health；Grafana/指标告警无验收 |
| 域名 | BLOCKED_BY_CONFIG | 源码含 `*.xyzwtt.com`，未做联网/DNS/证书验证 |

## 7. 十五项冲突处置

| # | 当前实现与风险 | 唯一方案 / 保留 / 废弃 / 迁移 |
|---:|---|---|
| 1 | PM2 与 Docker 均存在；可能双实例消费 | 只保留 Docker；PM2 归档；停旧实例须经服务器盘点和切换审批 |
| 2 | production 完整，gray 仅 overlay | gray 只允许双文件叠加；保留隔离卷/安全开关，废弃单文件启动 |
| 3 | Compose 自带 DB/Redis/MQTT，未知主机遗留 | 每环境唯一实例；先只读盘点端口/卷，再迁移数据并停遗留 |
| 4 | MQTT Direct 和 TB 都有设备能力 | MQTT 是控制总线，TB 只读诊断；禁用 TB 直接控制 |
| 5 | TB 同步可写 AgriOS Device 映射 | AgriOS 是主库；保留外部 ID，TB 只存影子/遥测 |
| 6 | BullMQ 与 memory adapter 共存 | production 强制 BullMQ；memory 仅测试；加分布式锁/唯一 job |
| 7 | 任意 fetch 异常均 fallback Mock | dev demo 显式开关；production fail closed 并构建门禁 |
| 8 | `mobile` 承担大量页面但电脑能力不足 | 收敛为一套响应式前端；补角色/断点，不另造三个产品 |
| 9 | web-admin/miniapp 仅 README | 冻结为空壳并标 OBSOLETE；不复制 mobile |
| 10 | Edge 云模型存在，Agent 不存在 | 保留 API/schema；Phase C 实现最小可版本化 Agent |
| 11 | 云端 Safety 丰富但 PLC 无证据 | PLC/硬接线最终权威；云端只做更保守预检；台架后开放 |
| 12 | 农事与 IoT 模型多但关联不一 | 统一 Farm/Field/Zone/operationId 时间线和审计 |
| 13 | adapter 枚举、MQTT、TB、Edge/PLC 入口并存 | 单 DeviceControl gateway；adapter 不得直接暴露业务入口 |
| 14 | 多个 Phase 文档/脚本与 V1 收敛冲突 | 历史只读；今后只使用 Master Backlog 的 A-G |
| 15 | HEAD 与远程一致但工作区改动集中在关键链路 | 全部保留；后续分 auth/queue/control/deploy 评审测试后独立提交 |

## 8. 验证基线

| 检查 | 结果 | 说明 |
|---|---|---|
| npm ci | SKIPPED | 已有 `node_modules` 且脏工作区；会删除重建依赖，审计阶段无必要风险 |
| Prisma validate | PASS | Schema valid；仅加载本地 env，不连接 DB |
| Prisma generate | PASS | 生成 Client 成功 |
| Backend build/typecheck | PASS | `nest build` 通过 |
| Backend tests | SKIPPED | package scripts 是需启动 API/DB/MQTT 的阶段验收脚本，无独立单元测试命令；禁止误连环境 |
| Mobile build/typecheck | PASS | `vue-tsc --noEmit && vite build` 通过 |
| Production compose config | BLOCKED | 首次被必填 `JWT_REFRESH_SECRET` 阻断；使用非秘密占位值复核后仍因 `AGRIOS_TLS_DIR` 等运行配置缺失产生无效挂载；未打印真实值 |
| Gray standalone config | FAIL | overlay 单独没有 image/build；设计上不应单独运行 |
| Gray overlay config | BLOCKED | 缺不可变 `AGRIOS_IMAGE_TAG`、TLS 目录及 secret/config；非秘密占位复核仍未通过 |
| 环境模板 | PARTIAL | backend 与 SaaS 示例存在；根生产配置仍依赖真实 env，未修改 |
| Secret/备份扫描 | PASS（名称级） | 检出本地 env 和 backup SQL；未打印内容；未见跟踪中的凭据型文件 |
| 大文件扫描 | PASS | 排除 `.git/node_modules` 后未发现 >10 MiB 文件 |
| 路由/API 清单 | PASS | 静态扫描 router 与 controller decorators |

## 9. 最大风险

1. API 全局 Mock fallback 可把生产错误伪装成成功数据。
2. 没有真实硬件、PLC 联锁或现场连续运行证据。
3. 多设备控制入口与多 adapter 尚未收敛。
4. BullMQ/memory 生产选择和幂等唯一约束不足。
5. 五类产品角色与 13 个数据库角色未映射。
6. 75 模型/55 模块的范围远超首个 Zone，测试密度不足。
7. Zone 缺清晰独立主模型，农事/IoT 关联可能割裂。
8. Compose/gray/PM2/Nginx/宝塔存在多套运行叙事。
9. 必填 secret 和不可变镜像标签尚未形成可验证 RC 配置。
10. Edge Agent、PWA 离线写入、监控和恢复演练均无交付证据。
