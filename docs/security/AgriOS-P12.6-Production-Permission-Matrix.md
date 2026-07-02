# AgriOS P12.6 Production Permission Matrix

## 角色

- `PLATFORM_ADMIN`：跨租户平台管理，必须审计。
- `TENANT_ADMIN`：租户内用户、农场、设备管理。
- `FARM_MANAGER`：管理农场作业。
- `OPERATOR`：发起普通作业，高风险动作需要审批。
- `VIEWER`：只读。
- `INSTALLER`：安装验收和蓝牙配网维护，不看财务/成本敏感数据。
- `MAINTAINER`：维护和设备诊断。

## 关键原则

1. VIEWER 只能看，不能执行。
2. OPERATOR 可以发起作业，但高风险动作需要审批。
3. INSTALLER 不能查看 billing / cost 敏感数据。
4. PLATFORM_ADMIN 可跨租户，但必须审计。
5. emergencyStop 是特殊权限，必须审计。
6. 开泵、开阀、施肥危险动作必须经过 Safety / Approval / ActionQueue。

## 权限 key

`mobile.read`, `device.read`, `device.manage`, `irrigation.execute`, `fertigation.execute`, `drone.review`, `report.read`, `cost.read`, `ai.read`, `safety.manage`, `approval.approve`, `action.execute`, `action.cancel`, `edge.manage`, `bluetooth.maintain`, `installer.check`, `audit.read`, `billing.manage`, `tenant.manage`, `user.manage`, `emergency.stop`.

## 已优先接入

- action-queue
- device-control
- safety
- approval
- drone review
- bluetooth sessions
- edge commands
- audit events
- billing

## TODO

旧 CRUD 读接口暂以 TenantGuard 或 farmId 过滤为主，后续逐步补全 PermissionGuard。
