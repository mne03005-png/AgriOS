# AgriOS P12 Tenant Isolation Audit

P12 建立 tenant isolation 基础机制，但不一次性重写所有旧 CRUD。

## 已建立机制

- JWT payload 包含 `userId / tenantId / farmId / role`。
- `RequestContextService` 保存当前请求上下文。
- `TenantGuard` 校验 query/header tenantId 与 JWT tenantId 是否一致。
- `withTenant()` 与 `tenantCreateData()` 提供 Prisma 查询/创建 helper。
- `PLATFORM_ADMIN` 可跨租户查看。

## 优先强制 tenant 过滤的模块

- drone-operation
- operation-cost
- crop-health
- yield-analysis
- operation-report
- farm-activity
- mobile
- irrigation-rotation
- fertigation
- action-queue
- safety

这些模块已有 `tenantId` 字段，后续 P12.1 应逐个接入 helper 或 guard。

## 暂未强制的旧模块

- users
- farms
- fields
- crop-seasons
- farm-inputs
- work-logs
- devices
- sensor-records
- irrigation-records
- cost-records
- service-providers

原因：这些模块来自 P1-P5 CRUD，需要逐个梳理历史 API、demo seed 和 Mobile fallback，避免一次性强改破坏已有演示。

## 风险说明

在 P12.0 阶段，旧接口如果未带 JWT 或未接入 tenant guard，仍可能通过显式 `farmId/fieldId` 查询数据。生产环境上线前必须完成 P12.1 的全量 tenant enforcement。

## P12.1 计划

1. 给高风险列表接口统一接入 `TenantGuard`。
2. 将所有 create 操作写入 `tenantId`。
3. 将 Mobile API 按当前用户 tenant/farm 自动收敛。
4. 增加跨租户访问测试。
5. 保留 `demo` farm fallback，但仅在非生产环境启用。

## P12.1 高风险模块状态

| 模块 | 是否已强制 tenant | 风险等级 | 说明 | 后续计划 |
| --- | --- | --- | --- | --- |
| mobile | 部分 | 中 | demo fallback 保留，后续按 JWT farm/tenant 收敛 | P12.1 后续批次全量 guard |
| drone-operation | 部分 | 中 | 上传安全已增强，列表仍保留 demo 兼容 | 增加 tenant helper |
| operation-report | 部分 | 中 | 依赖 farmId 过滤 | 增加 tenant helper |
| operation-cost | 部分 | 高 | 成本敏感 | 接入 PermissionGuard |
| crop-health | 部分 | 中 | 农事观察数据 | 接入 tenant helper |
| yield-analysis | 部分 | 中 | 产量因素数据 | 接入 tenant helper |
| farm-activity | 部分 | 中 | 时间线数据 | 接入 tenant helper |
| action-queue | 是 | 高 | 已接入 JwtAuthGuard / TenantGuard / PermissionGuard | 补自动化测试 |
| audit | 是 | 高 | 已接入 JwtAuthGuard / TenantGuard / PermissionGuard | 补跨租户测试 |
| safety | 是 | 高 | 已接入 JwtAuthGuard / TenantGuard / PermissionGuard | 补 emergencyStop 审计测试 |
| fertigation | 部分 | 高 | 执行动作仍走安全链 | 接入 PermissionGuard |
| irrigation-rotation | 部分 | 高 | 执行动作仍走安全链 | 接入 PermissionGuard |
