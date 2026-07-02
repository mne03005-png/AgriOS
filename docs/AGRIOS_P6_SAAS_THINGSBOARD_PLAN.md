# AgriOS P6 SaaS ThingsBoard 集成计划

## P6 定位

AgriOS 负责农业业务：农场、地块、种植季、农事、农资、成本、灌溉建议和业务追溯。

ThingsBoard 负责物联网底座：设备接入、遥测数据、设备状态、规则链、看板和基础设备运维。

P6 的边界是集成，不是重写 ThingsBoard。AgriOS 不复制 ThingsBoard 源码，只维护 Docker 部署配置、环境变量和 API/Webhook 对接。

## SaaS 部署架构

```text
用户/管理端
  |
  v
Nginx / Gateway
  |---------------------> AgriOS API
  |                         |
  |                         v
  |                      MySQL / Redis
  |
  |---------------------> ThingsBoard Web/API
                            |
                            v
                         PostgreSQL

设备 -> MQTT -> ThingsBoard -> Webhook/API -> AgriOS
```

建议域名：

- `PUBLIC_APP_URL`：AgriOS Web Admin
- `PUBLIC_API_URL`：AgriOS API
- `PUBLIC_IOT_URL`：ThingsBoard Web

## 本地开发启动方式

启动 ThingsBoard CE 和 PostgreSQL：

```bash
cd infra/thingsboard
docker compose up -d
```

访问：

```text
http://localhost:8080
```

MQTT：

```text
localhost:18830
```

端口 `18830` 映射到容器内 `1883`，避免与 AgriOS 现有 Mosquitto 的 `1883` 冲突。

## AgriOS 与 ThingsBoard 的关系

P6.0 暂不改变现有 AgriOS 业务逻辑。后续 AgriOS 将通过 ThingsBoard Webhook 接收遥测数据，并继续沿用 AgriOS 的农业业务模型：

- ThingsBoard 收设备遥测。
- ThingsBoard 规则链转发遥测到 AgriOS Webhook。
- AgriOS 根据土壤湿度生成 IrrigationAdvice。
- 当前阶段不自动开泵，只自动生成灌溉建议，仍由人工确认执行。

## P6.1-P6.5 路线

### P6.1 ThingsBoard Webhook 接入

- 在 AgriOS 增加 ThingsBoard Webhook 接口。
- 校验 `THINGSBOARD_WEBHOOK_SECRET`。
- 将 ThingsBoard 遥测转换为 AgriOS SensorRecord。

### P6.2 设备映射

- 建立 AgriOS Device 与 ThingsBoard Device 的映射字段。
- 支持按地块查看 ThingsBoard 设备。

### P6.3 遥测规则联动

- ThingsBoard 上报 soilMoisture。
- AgriOS 生成 IrrigationAdvice。
- 保持人工确认执行，不直接自动开泵。

### P6.4 设备命令闭环

- AgriOS 下发命令到 ThingsBoard 或 MQTT。
- ThingsBoard/设备回执同步到 DeviceCommand。

### P6.5 SaaS 部署增强

- Nginx 反向代理。
- HTTPS。
- 环境变量分层。
- 日志、备份和监控。

## 当前阶段不做

- 不复制 ThingsBoard 源码。
- 不改造 ThingsBoard 前端。
- 不做自动开泵。
- 不做复杂设备规则链。
- 不做多租户计费。

## P6.1 ThingsBoard Rule Chain 配置

### 1. 登录 ThingsBoard

```text
http://localhost:8080
```

### 2. 创建测试设备

设备名称：

```text
soil_sensor_001
```

创建设备后，在 ThingsBoard 中获取该设备的 Access Token。

### 3. MQTT 上报主题

```text
v1/devices/me/telemetry
```

### 4. MQTT 测试数据

```json
{
  "soilMoisture": 22,
  "temperature": 32,
  "humidity": 65
}
```

### 5. Rule Chain Webhook

本机 Docker 中访问宿主机 AgriOS 后端时使用：

```text
http://host.docker.internal:3000/api/v1/iot/thingsboard/telemetry
```

Webhook Header：

```text
x-thingsboard-secret: agrios_tb_secret
```

说明：

- ThingsBoard 负责接收设备数据。
- AgriOS 负责业务规则和灌溉建议。
- 当前阶段不自动开泵，只生成待人工确认的灌溉建议。

## P6.1 AgriOS Webhook

接口：

```text
POST /api/v1/iot/thingsboard/telemetry
```

支持 ThingsBoard values 嵌套格式和扁平格式。

如果设备已在 AgriOS 中绑定地块，系统会保存 `SensorRecord` 并按土壤湿度生成 `IrrigationAdvice`。

如果设备未绑定地块，系统只保存遥测记录和操作日志，不生成灌溉建议。

## SaaS 正式部署架构

正式售卖时采用自托管 SaaS：

服务器服务：

- agrios-web
- agrios-backend
- agrios-db
- agrios-redis
- thingsboard-ce
- thingsboard-postgres
- nginx

推荐域名：

- AgriOS 前端：`https://app.agrios.com`
- AgriOS API：`https://api.agrios.com`
- ThingsBoard：`https://iot.agrios.com`

说明：

1. 客户不需要安装 ThingsBoard。
2. 客户只访问 AgriOS SaaS。
3. ThingsBoard 作为后台物联网底座运行。
4. 后期可以用 Nginx 统一入口。
5. 当前本地开发阶段先使用 `localhost:8080` 和 `localhost:18830`。
