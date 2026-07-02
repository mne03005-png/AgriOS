# AgriOS P12.1 Tenant Isolation Test Plan

## 目标

验证普通用户只能访问自己 tenant 数据，`PLATFORM_ADMIN` 可跨租户但必须写审计，未登录 demo fallback 只能访问 `farmId=demo`。

## 手动步骤

1. 注册 tenant A 用户并登录，保存 token A。
2. 注册 tenant B 用户并登录，保存 token B。
3. 使用 token A 访问 tenant B 数据，预期 403。
4. 使用 `PLATFORM_ADMIN` token 跨 tenant 访问，预期成功并写 `cross_tenant_access` 审计。
5. 不带 token 访问非 demo farm，预期 403。
6. 不带 token 访问 `farmId=demo`，预期允许 demo fallback。

## 示例

```powershell
$tokenA = "replace_me"
$tenantB = "tenant_b"
curl -H "Authorization: Bearer $tokenA" "http://localhost:3000/api/v1/mobile/cockpit?farmId=farm_b&tenantId=$tenantB"
```

## 覆盖模块

P12.1 优先覆盖 mobile、drone-operation、operation-report、operation-cost、crop-health、yield-analysis、farm-activity、action-queue、audit、safety、fertigation、irrigation-rotation。旧 CRUD 全量强制计划放到 P12.1 后续批次。
