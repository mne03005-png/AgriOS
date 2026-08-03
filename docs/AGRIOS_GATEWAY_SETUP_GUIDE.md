# AgriOS GW-01 Gateway Station 配置指南

> 适用设备：Milesight UR35 + UG65-470M + Raspberry Pi 4B Edge。UI 名称可能随固件变化，操作前保存配置备份和截图。

## 1. 配置前准备

| 项目 | 现场值 |
|---|---|
| Tenant ID | __________ |
| Farm ID | __________ |
| Gateway Device Key | `gdn-01-gw-01` |
| MQTT Broker FQDN | __________ |
| MQTT TLS Port | `8883` |
| 主/备运营商与 APN | __________ / __________ |
| LoRa 频率计划 | `CN470`，具体子频段：__________ |
| NTP Server | __________ |
| Edge LAN 地址 | `10.29.0.10/24` |
| UG65 LAN 地址 | `10.29.0.20/24` |
| UR35 LAN 地址 | `10.29.0.1/24` |

下载固件、CA 证书和安装包时核对 SHA-256。配置电脑关闭其他网卡和代理，只接维护 LAN；禁止把默认管理口暴露到公网。

## 2. SIM 安装与 UR35 网络配置

1. 断开 UR35 电源，释放人体静电。将中国移动 SIM 插入 SIM1、中国联通 SIM 插入 SIM2，方向按机壳图标；连接 4G 天线后再上电。
2. 通过独立网线登录 UR35，立即修改管理员密码，建立 `agrios-admin` 维护账号并关闭默认账号远程登录。
3. 设置 LAN `10.29.0.1/24`；DHCP 仅分配 `10.29.0.100–150`，为 Edge/UG65 做 MAC 静态租约。
4. 配置 SIM1/SIM2 的 APN、PIN（如有）和数据漫游策略。主链路为信号/资费更优者，备链路仅在健康检查连续失败后切换。
5. 健康检查同时使用运营商网关、公共 DNS 和 AgriOS MQTT FQDN；连续 3 次失败切换，稳定 15 分钟后才允许回切，避免抖动。
6. 防火墙默认拒绝 WAN 入站；只允许 LAN 出站到 DNS 53、NTP 123、MQTT/TLS 8883、HTTPS 443 和批准的 VPN。
7. 启用 WireGuard/OpenVPN 维护隧道；禁止端口映射 22/80/443 到 Edge 或 UG65。
8. 记录 SIM ICCID、IMEI、运营商、APN、RSRP/RSRQ/SINR 和切换测试时间。

验收：断开 SIM1 或屏蔽其 APN，SIM2 在目标时间内恢复 MQTT；恢复 SIM1 后不反复切换。

## 3. UG65 LoRaWAN 配置

1. 将 UG65 接入 UR35 LAN，设置静态地址 `10.29.0.20/24`、网关/DNS `10.29.0.1`，修改管理员密码并导出初始备份。
2. 升级到采购验收通过的固定固件版本；不要在 Day1 自动升级。
3. Radio Region 选择 `CN470`。具体通道计划必须与全部节点一致；保存通道列表截图，不能只记录“CN470”。
4. 启用内置 LoRaWAN Network Server，使用 OTAA；关闭未经批准的 ABP 和公共 Join Server。
5. 为每个节点录入唯一 DevEUI、JoinEUI/AppEUI 和 AppKey。AppKey 从密码库注入，不进入施工照片、日志或二维码。
6. Class A 用于 LSE01/EM300；UC300 控制端按厂家支持和能耗要求配置 Class C/D2D，但安全关闭不得依赖云下行。
7. 设置 ADR、确认上行和重试：初装阶段保留完整 RF 元数据；稳定后再根据丢包率调整。禁止为追求 RSSI 盲目提高发射功率。
8. 安装 AgriOS payload decoder，把厂家字段映射为 `soilMoisture`、`temperature`、`humidity`、`battery`、`signalStrength` 和 `values`。

节点上线表：

| Device Key | DevEUI | Zone | Join 成功 | RSSI/SNR | 固件 |
|---|---|---|---|---|---|
| gdn-01-soil-a-01 | | A | [ ] | | |
| gdn-01-soil-b-01 | | B | [ ] | | |
| gdn-01-soil-c-01 | | C | [ ] | | |
| gdn-01-soil-d-01 | | D | [ ] | | |
| gdn-01-weather-01 | | Shared | [ ] | | |
| gdn-01-control-01 | | Pump house | [ ] | | |

## 4. Edge 安装与网络

1. Raspberry Pi OS Lite 64-bit 写入 SSD，关闭密码 SSH，创建非默认用户，启用 SSH key 和全盘/应用密钥保护。
2. 固定地址 `10.29.0.10/24`，默认网关 `10.29.0.1`。设置主机名 `agrios-gdn01-edge01`。
3. 设置时区 `Asia/Shanghai`，启用 chrony；RTC、NTP 和 Cloud 时间差必须 <2 s。无网时由 RTC 保持时间。
4. 数据盘挂载启用断电安全参数；创建独立服务账户运行 Edge Agent，目录权限只允许该账户访问。
5. 安装容器运行时和固定版本 Edge Agent；配置 systemd/Docker restart、硬件看门狗、日志轮转和磁盘 70/85/95% 水位告警。
6. 在本地建立 `telemetry`、`offline_queue`、`command_journal` SQLite 表，执行断电重启完整性检查。

## 5. MQTT TLS

### 5.1 Cloud 设备注册

1. 在 AgriOS 创建 `EDGE_GATEWAY`：Device Key `gdn-01-gw-01`，绑定 Tenant/Farm。
2. 生成一次性 MQTT Credential，立即存入 Edge 的受限 secret 文件/密码库；文档只记录 credential ID 后四位。
3. 下载 AgriOS Broker CA 链，记录证书 SHA-256 和到期日。
4. Gateway ACL 只允许：
   - publish `agrios/{tenant}/gdn-01-gw-01/telemetry`
   - publish `agrios/{tenant}/gdn-01-gw-01/event`
   - subscribe `agrios/{tenant}/gdn-01-gw-01/commands`

### 5.2 Edge MQTT Client

配置原则：

```yaml
broker: mqtts://mqtt.example.com:8883
clientId: <provisioned MQTT username>
clean: false
qos: 1
keepaliveSeconds: 60
reconnect:
  minimumSeconds: 3
  maximumSeconds: 300
  jitter: true
tls:
  caFile: /etc/agrios/tls/ca.pem
  verifyHostname: true
  minimumVersion: TLSv1.2
```

禁止 `insecureSkipVerify`、固定公共密码和明文 1883 外网连接。命令主题禁止 retained；所有命令必须有 `correlationId`、`expiresAt` 和签名/权限上下文。

### 5.3 UG65 → Edge

UG65 将解码后的节点数据通过 LAN 内 MQTT(S)/HTTP(S) 发给 Edge。内部地址不得直接写 Cloud：

- internal: `edge/gdn-01/{devEui}/uplink`
- Cloud v1: `agrios/{tenant}/{device}/telemetry`

Edge 是唯一 Cloud 写入者：为每条上行生成/保留 `messageId`，落盘成功后才确认内部消息，然后转换到相应 Device 的 v1 Topic。Cloud QoS 1 PUBACK 后才能从 offline queue 删除，以 `deviceId + messageId` 去重。

## 6. AgriOS 设备注册与绑定

按以下顺序执行：Tenant → Farm → Field → Zone A–D → Gateway → Sensors/Controller。

| 类型 | Device Key | 绑定 |
|---|---|---|
| EDGE_GATEWAY | `gdn-01-gw-01` | Tenant + Farm |
| SOIL_SENSOR | `gdn-01-soil-a-01` 等 | Field + 对应 Zone |
| WEATHER_STATION | `gdn-01-weather-01` | Farm + Field |
| VALVE_CONTROLLER | `gdn-01-control-01` | Field/Zone 或控制箱安装记录 |

每台设备先上传一次测试遥测，再查 AgriOS 设备详情确认：ONLINE、lastSeenAt、battery、signalStrength、Farm/Field/Zone 全部正确。错误绑定必须先修正再安装，禁止用 Topic 名称代替数据库绑定。

## 7. 断网与恢复验证

1. 在线运行 15 分钟，记录 Cloud 收到的 messageId/sequence。
2. 在 UR35 关闭两个蜂窝接口，保持 LAN、UG65 和 Edge 供电。
3. 连续采集 60 分钟；确认 Edge 状态 OFFLINE、缓存增长、传感器未停止、本地安全规则仍可关阀。
4. 恢复 SIM2；确认状态 RECOVERING，实时数据优先、历史限速补传。
5. 核对缓存条数 = 成功补传 + 明确无效条数，Cloud 重复 messageId 为 0。
6. 验证离线时创建的云命令不会被误标为已执行，过期命令恢复后不执行。

## 8. 配置备份与交付

- UR35、UG65 配置导出文件加密存储，文件名包含设备序列号和固件版本。
- Edge 保存系统镜像版本、容器 digest、配置哈希、数据库迁移版本和恢复步骤。
- 密钥、AppKey、SIM PIN 和 MQTT 密码不进入 Git、纸质表或照片。
- 交付截图：双 SIM、CN470 通道、节点 Join、MQTT TLS、设备 ONLINE、断网缓存和补传完成。
