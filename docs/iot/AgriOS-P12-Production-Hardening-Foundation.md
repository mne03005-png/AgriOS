# AgriOS P12 Production Hardening Foundation

P12 的目标是把 AgriOS 从 Demo 产品推进到可部署的生产化底座：统一配置、登录、租户隔离、队列、健康检查、上传安全、审计、错误追踪、Docker Compose 和 Mobile 登录接入。

## 为什么进入生产化

P11 已经能演示 IoT、GIS、灌溉、水肥、无人机、成本、作物健康、产量因素和移动端中控屏。P12 不继续堆大功能，而是补齐生产环境需要的安全边界、可观测性、配置校验和部署入口。

## 本阶段范围

- Redis/BullMQ ActionQueue 适配器基础
- JWT/RBAC 基础
- tenant isolation 基础机制
- config validation
- health/readiness/metrics
- upload security
- audit hardening
- requestId/error response
- docker compose
- mobile auth integration

## 本阶段不做

- 不接真实硬件控制
- 不自动开泵/开阀
- 不接 DJI SDK
- 不做真实病虫害 AI
- 不做真实产量预测
- 不改变 ThingsBoard/Webhook 主采集流程

## 数据链路

```text
User -> Tenant -> Farm -> Field/Device/Action/Report
```

普通用户以后应只能访问自己 tenant 下的数据；`PLATFORM_ADMIN` 预留跨租户管理能力。

## 安全边界

- 后端 Safety 是最终控制点。
- 前端不能绕过审批、队列和安全策略。
- `ENABLE_AUTO_EXECUTION=false` 默认不自动执行。
- `DEVICE_CONTROL_MODE=MOCK` 默认不控制真实设备。
- ActionQueue 仍保持 `ActionPlan -> Safety -> Approval -> ActionQueue -> ActionExecution -> DeviceControl` 链路。

## 环境变量

见 `apps/backend/.env.example`。生产环境必须配置：

```env
DATABASE_URL="mysql://agrios:your_password@localhost:3306/agrios"
JWT_SECRET=REPLACE_WITH_LONG_RANDOM_SECRET
JWT_EXPIRES_IN="7d"
ENABLE_AUTO_EXECUTION=false
DEVICE_CONTROL_MODE=MOCK
UPLOAD_MAX_FILE_MB=20
CORS_ORIGINS="http://localhost:5174,http://localhost:5173"
```

`REDIS_URL` 与 `ACTION_QUEUE_DRIVER=bullmq` 用于生产队列；未配置、Redis 不可用或 BullMQ 初始化失败时 fallback 到 memory queue，并输出 warning。
