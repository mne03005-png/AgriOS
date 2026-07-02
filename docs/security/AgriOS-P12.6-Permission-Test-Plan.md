# AgriOS P12.6 Permission Test Plan

## 验证点

- VIEWER 不能 execute。
- OPERATOR 不能 approve 高风险操作。
- INSTALLER 不能查看 cost/billing。
- TENANT_ADMIN 可管理租户内用户和设备。
- PLATFORM_ADMIN 跨租户访问写 audit。
- emergencyStop 写 audit。

## 示例

```powershell
$viewerToken = "replace_me"
curl -X POST "http://localhost:3000/api/v1/action-queue/enqueue" -H "Authorization: Bearer $viewerToken" -H "Content-Type: application/json" -d "{\"farmId\":\"demo\",\"actionPlanId\":\"replace_me\"}"
```

预期：403，返回“当前角色无权限执行该操作”。
