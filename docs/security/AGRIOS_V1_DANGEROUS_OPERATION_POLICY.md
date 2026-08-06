# AgriOS V1.0 危险操作策略

覆盖开/关阀、启/停泵、手动灌溉、急停、禁用设备/用户、高风险审批和 AUTO。

前端统一流程显示操作、对象、农场、Zone 和风险，要求明确确认、必填原因和短时 re-auth token；离线立即阻止。提交后的正式状态使用提交/排队/确认/失败/超时，禁止 Mock 成功。

后端 `ReauthGuard` 校验 5 分钟 re-auth JWT 与当前用户及 `tokenVersion` 一致，要求原因并写 `dangerous_operation.requested` 审计（用户、tenant、设备、原因、IP、User-Agent、requestId）。设备控制仍再次经过 JWT、Tenant、Permission、Safety；真实控制默认保持 MOCK/dry-run/AUTO false。

目前 re-auth API 已提供，但前端仍以 token 输入完成基线，尚未做完整密码弹窗/无障碍对话框体验；禁用用户/设备和高风险审批的所有 Controller 尚未统一接入该 Guard，状态为 PARTIAL。
