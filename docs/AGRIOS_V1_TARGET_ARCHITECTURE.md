# AgriOS V1.0 唯一目标架构

> 架构决定基线：2026-08-06。未经过硬件和现场验收的链路不得宣称生产可用。

## 分层与职责

```text
Vue 3/Vite 响应式前端（五类角色）
                 |
       HTTPS / NestJS API
                 |
 MySQL（业务主数据） + Redis/BullMQ（唯一异步队列）
                 |
       Mosquitto MQTT TLS（唯一现场消息总线）
                 |
 Edge Agent（协议、缓存、补传、去重、本地批准、配置版本）
                 |
 PLC/硬接线（不可绕过的安全）——传感器、阀、泵、流量、水位、太阳能
```

用户层采用 FARMER、MANAGER、INSTALLER、ENGINEER、SUPER_ADMIN 五类产品角色。云端 NestJS 是唯一业务 API；MySQL 是用户、租户、农场、地块、Zone、设备映射、命令、审批、农事、告警、报表和审计的唯一主数据源。Redis/BullMQ 只承载可重放任务，不承载主数据。

## 命令流与安全边界

1. 用户/计划提交意图；云端校验租户、权限、审批、Safety 和设备状态。
2. MySQL 先记录带全局 `commandId/idempotencyKey` 的命令，再由 BullMQ 唯一消费者发布至 MQTT TLS。
3. Edge 校验配置版本、批准令牌、过期时间和去重键，再交给 PLC。
4. PLC 独立执行急停、缺水、过载、无流量、超压、阀泵互锁、最大运行时长、手动/停止/自动和失联安全态。
5. ACK/反馈沿原链路返回，云端更新命令、灌溉记录和审计；超时不得被推断为成功。

云端和 AI 只能建议或授权，不能替代 PLC 硬安全。Edge 不能自行扩大云端批准范围。真实控制必须同时满足非 Mock、非 dry-run、显式允许、反馈可用以及硬件验收；默认全部关闭。

## 数据、遥测与离线流

- 遥测：设备→Edge→MQTT→NestJS→MySQL；以设备 ID、采样时间、序列号/消息 ID 去重，原始时间和接收时间分开保存。
- 离线：Edge 持久化顺序队列和配置快照；恢复后按幂等键补传，云端返回逐条 ACK；过期控制命令不得补执行。
- 主数据只在 AgriOS；ThingsBoard 可复制诊断所需的设备影子/遥测，不反向成为农场/地块/设备业务主数据。

## Edge、PLC 与设备

Edge 负责 Modbus/LoRaWAN/4G 等协议转换、本地缓存、补传、命令去重、本地批准规则、MQTT、配置版本和状态同步。PLC/硬接线负责所有即时安全联锁。设备层包括土壤/天气、太阳能、泵阀、流量和水位；首期只验收一个 Zone。

## 开源软件边界

| 软件 | 唯一边界 | V1 状态 |
|---|---|---|
| farmOS | 借鉴 Asset + Log，不部署第二业务核心 | DESIGN_ONLY |
| QGIS/QField | GIS 采集与标准文件交换 | PARTIAL |
| ThingsBoard | 工程师诊断、设备影子和遥测辅助 | BLOCKED_BY_CONFIG |
| Grafana | 工程趋势与基础设施监控 | DESIGN_ONLY |
| WebODM | V1.1 可选 Connector | DESIGN_ONLY |
| ChirpStack | V1.2 多 LoRaWAN 网关预留 | DESIGN_ONLY |
| Hiveeyes/AquaCrop/AgOpenGPS | 研究储备，不进入 V1 运行面 | OBSOLETE（对 V1） |

## 唯一部署架构

生产只采用 `docker-compose.production.yml` 管理 API、前端、MySQL、Redis 和 Mosquitto；`docker-compose.gray.yml` 只能作为 production 的覆盖文件，并使用独立项目名、网络、卷和端口。PM2 方案废弃为历史回退说明，不得与 Docker 同机双跑。Nginx/宝塔仅做 TLS 终止与反向代理，不运行第二套 API。ThingsBoard/Grafana 是隔离的工程工具，禁止拥有业务主数据或直接绕过 AgriOS 下发控制。

部署必须使用不可变镜像标签、外部 secret 目录、健康检查、日志轮转、备份恢复和可审计切换。当前 Compose 因必填密钥/镜像标签缺失尚不能形成生产候选版。
