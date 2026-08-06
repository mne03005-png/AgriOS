# AgriOS V1.0 正式数据状态策略

统一 envelope：`data/source/status/lastUpdatedAt/freshness/errorCode/errorMessage/retryable`，兼容保留 `isMock`。状态为 LOADING、LIVE、STALE、EMPTY、OFFLINE、ERROR、MOCK。

- 开发：`VITE_ALLOW_MOCK_DATA` 默认允许；fallback 必须标记 source/status 为 MOCK。
- 测试：必须显式设置该变量。
- 生产：代码强制 `mockAllowed=false`；Vite 在生产构建发现变量为 true 时直接失败。
- fetch 异常且 Mock 禁用时返回 ERROR/OFFLINE envelope，数据为 null；不得使用 Demo 数据填充。
- 所有非 GET 请求在浏览器离线时返回 `OFFLINE_COMMAND_BLOCKED`，不会发出请求或显示成功。

旧页面仍有部分以 Demo 数据初始化的展示逻辑，虽生产 API 失败已不会由统一请求层返回 Mock，但页面级初始值清理尚未全量完成，因此数据策略整体状态为 PARTIAL。
