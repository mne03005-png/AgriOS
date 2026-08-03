# AgriOS Edge Gateway 初始化与配置流程

> 目标：把一套已验收的 UR35 + UG65 + Raspberry Pi Edge 初始化为可恢复、最小权限、MQTT/TLS 加密的 `gdn-01-gw-01`。

## 1. 发布输入与责任边界

| 输入 | 必填值 |
|---|---|
| Tenant/Farm/Field IDs | __________ / __________ / __________ |
| Gateway Device Key | `gdn-01-gw-01` |
| Edge release version | __________ |
| OCI image digest | `sha256:__________` |
| Raspberry Pi OS image SHA-256 | __________ |
| Broker FQDN/port | __________ / 8883 |
| Broker CA SHA-256/expiry | __________ / __________ |
| LoRa plan | CN470 子频段/通道：__________ |
| Change ticket | __________ |

仓库当前提供 Gateway simulator 与架构设计，但生产 Edge 镜像必须由发布流程构建、签名并给出 digest。本指南禁止部署 `latest`、未经签名的个人镜像或把 simulator 当生产 Edge Agent。

## 2. 系统安装

1. 在受控电脑下载 Raspberry Pi OS Lite 64-bit 和签名/校验值，离线核对 SHA-256。
2. 将系统写入 Samsung T7 Shield SSD；首次启动禁用默认用户和密码 SSH，只注入项目 SSH 公钥。
3. 设置 hostname `agrios-gdn01-edge01`、时区 `Asia/Shanghai`、静态 LAN `10.29.0.10/24`、网关/DNS `10.29.0.1`。
4. 启用硬件 RTC、chrony 和 watchdog；NTP 正常时与 Cloud 偏差 <2 s，断网重启后时间不得回退。
5. 创建无登录 shell 的 `agrios-edge` 服务账号；应用、数据、日志、secret 分目录且最小权限。
6. 开启自动安全更新的维护窗口；内核/固件功能升级在台架验证后人工批准，不在 Day1 自动升级。
7. 配置日志轮转、journald 上限、SSD SMART/文件系统检查和 70/85/95% 存储水位。
8. 导出系统清单：OS、kernel、package versions、SSH host fingerprint、disk UUID 和配置哈希。

## 3. Docker 部署

1. 从发行版官方仓库安装 Docker Engine 与 Compose plugin，固定已验证版本。
2. 创建独立网络 `agrios-edge`；容器默认无特权、只读根文件系统、drop all capabilities，按需要逐项添加。
3. 数据卷至少包含：
   - `/var/lib/agrios/telemetry`
   - `/var/lib/agrios/offline-queue`
   - `/var/lib/agrios/command-journal`
   - `/var/log/agrios`
4. CA、MQTT 凭据和 LoRa AppKey 以只读 secret 挂载；不得写入 compose、镜像层、环境导出或 Git。
5. Compose 只引用 digest：`${REGISTRY}/agrios-edge@sha256:...`；健康检查验证数据库可写、内部 MQTT、Cloud 状态和队列水位。
6. 执行 `docker compose config` 审查展开配置，再启动；记录容器 ID、digest、启动时间和健康状态。
7. 配置 `restart: unless-stopped`，但使用 crash-loop 限制；连续失败进入 SAFE_MODE，禁止泵启动。
8. 完成关机、意外断电和 SSD 重新挂载测试，确认 SQLite integrity check 通过。

生产 compose 由发布包提供，本文件不复制可能过时的镜像地址或 secret。部署者必须保存 compose 文件 SHA-256。

## 4. MQTT/TLS 与身份

### 4.1 Gateway 身份

1. 在 AgriOS 创建 `EDGE_GATEWAY`，Device Key `gdn-01-gw-01`，绑定 Tenant + Farm。
2. 生成一次性 Gateway MQTT 凭据，只允许自身 telemetry/event 和 commands/ack 主题。
3. 安装 Broker CA，开启 TLS 1.2+、主机名验证、QoS1、persistent session；测试错误 CA/密码必须失败。

### 4.2 LoRa 设备身份

LoRa 节点不直接连接 MQTT。每个节点采用双重身份映射：

`DevEUI → AgriOS Device Key/ID → 该设备 MQTT Credential secret reference`

- Edge 密钥库保存每设备凭据，日志仅显示 secret reference 后四位。
- 向 Cloud 发布节点遥测时使用对应设备身份和 ACL，不给 Gateway 租户级 `agrios/{tenant}/+` 通配发布权限。
- 凭据缺失、DevEUI 重复或映射不唯一时，把帧放入 quarantine，不得猜测 Zone 或借用其他设备凭据。
- 轮换凭据采用双连接短窗口，验证新凭据后立即撤销旧凭据并记录审计事件。

Cloud v1 主题保持：

```text
agrios/{tenant}/{device}/telemetry
agrios/{tenant}/{device}/commands
agrios/{tenant}/{device}/ack
agrios/{tenant}/{device}/event
```

## 5. Gateway 注册

1. 创建 Tenant/Farm/Field/Zone A–D，记录真实数据库 ID。
2. 注册 Gateway Station 资产，写入 UR35/UG65/Edge 三个序列号、固件/OS、LAN 地址和安装位置。
3. 注册 `EDGE_GATEWAY` Device，运行一次 Gateway heartbeat：4G 状态、RSRP/RSRQ、LoRa 节点数、cacheDepth、Edge mode。
4. 查询 AgriOS 设备详情，确认 ONLINE、lastSeenAt、battery/SOC、signalStrength、Farm 绑定正确。
5. 保存 Gateway 配置、ACL、证书指纹和 API 响应证据，不保存明文密钥。

## 6. LoRa 配置

1. UG65 选择 CN470 并锁定批准的具体通道计划；导出配置截图/文件。
2. 启用 OTAA；为 LSE01、EM300-TH、UC300 录入唯一 DevEUI/JoinEUI/AppKey。
3. LSE01/EM300 使用 Class A；UC300 使用批准的控制模式，但安全关闭由 LOGO!/硬接线完成。
4. 节点先在 3 m 台架 Join，再到计划安装点 Join；记录 RSSI、SNR、data rate、gateway/channel。
5. 配置 payload decoder，保留原始 payload 哈希；单位和有效范围按设备协议固定。
6. UG65 仅把内部 uplink 发往 Edge LAN，不能同时直发 Cloud，避免双写。

## 7. 设备绑定

| Device | Type | AgriOS binding | Edge mapping |
|---|---|---|---|
| gdn-01-soil-a-01 | SOIL_SENSOR | Field + Zone A | LSE01 DevEUI → device secret |
| gdn-01-soil-b-01 | SOIL_SENSOR | Field + Zone B | 同上 |
| gdn-01-weather-01 | WEATHER_STATION | Farm + Field | EM300 DevEUI → device secret |
| gdn-01-control-01 | VALVE_CONTROLLER | Field/安装记录 | UC300 DevEUI → device secret |

绑定变更须暂停该设备转发，复核历史归属，再应用新映射。不得仅修改 Topic 字符串来移动设备。

## 8. 初始化验证与封存

- [ ] Reboot 后所有服务 5 min 内 HEALTHY，Gateway heartbeat 可见。
- [ ] 真实 LoRa uplink → Edge 落盘 → MQTT QoS1 → AgriOS latest 完整通过。
- [ ] Cloud 断开 60 min：cache 增长，本地规则有效；恢复补传 100%，重复 0。
- [ ] 错误 DevEUI 进入 quarantine，错误 MQTT 凭据/CA 被拒绝。
- [ ] Edge/UG65 双写检查：同一原始 uplink 在 Cloud 只有一个 messageId。
- [ ] 急停/缺水/超时保护在 Cloud、Edge 或 LoRa 失效时仍工作。

封存：系统镜像/compose/image digest、UR35/UG65 配置、设备映射清单和恢复手册进入受控备份；操作者和复核者双签。

操作者：__________  复核者：__________  日期：__________  结果：[ ]PASS [ ]FAIL
