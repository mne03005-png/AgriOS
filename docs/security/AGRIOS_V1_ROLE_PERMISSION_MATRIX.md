# AgriOS V1.0 角色权限矩阵

后端是权限最终权威。前端导航和 route meta 只提供可用性，不构成授权。

## 兼容映射

| Canonical role | Legacy roles |
|---|---|
| FARMER | FARMER, OPERATOR, VIEWER, DRONE_PILOT, MACHINERY_PROVIDER, INPUT_STORE |
| MANAGER | LARGE_GROWER, COOPERATIVE_ADMIN, TENANT_ADMIN, FARM_MANAGER |
| INSTALLER | INSTALLER |
| ENGINEER | MAINTAINER |
| SUPER_ADMIN | PLATFORM_ADMIN |

实现位于 `canonical-role.ts`。认证响应同时返回 `canonicalRole`、`legacyRole` 和 `effectivePermissions`；数据库旧枚举和旧数据未删除。

## 权限摘要

| 能力 | FARMER | MANAGER | INSTALLER | ENGINEER | SUPER_ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|
| 驾驶舱/地图/设备只读/简单报表 | ✓ | ✓ | 现场范围 | ✓ | ✓ |
| 手动灌溉/停止/急停 | 授权范围 | ✓ | 安全测试 | 测试 | ✓ |
| 审批、成员、成本、计划 | — | ✓ | — | 诊断只读 | ✓ |
| 安装检查/绑定/遥测预览 | — | 分配 | ✓ | ✓ | ✓ |
| Edge/MQTT/TB/队列诊断 | — | — | 有限 | ✓ | ✓ |
| 租户/平台配置/跨租户 | — | — | — | — | 显式平台上下文 |
| AUTO | 禁止 | 禁止绕过 | 禁止 | 禁止绕过 | 仍需验收/审批 |

所有非 SUPER_ADMIN 访问均保持 tenant 限制。SUPER_ADMIN 跨租户时必须提供 `x-platform-context: true`，TenantGuard 写入审计；修改 localStorage 或请求角色参数不能改变后端 JWT/数据库解析出的权限。

## 已知边界

现有业务 Controller 的历史权限覆盖仍需在 Phase E 形成全接口矩阵回归。本阶段重点工程、安装、审计、队列和设备控制入口已使用 JWT、TenantGuard 和 PermissionsGuard；设备控制写入口额外使用 ReauthGuard。
