# AgriOS V1.0 Phase A 验收

结论：**PARTIAL，不能标记完成**。

| 条件 | 结果 | 证据/阻断 |
|---|---|---|
| 五类角色兼容映射 | REAL | 后端/前端 canonical mapping 与契约测试 |
| 后端权限最终权威 | PARTIAL | 关键入口已 Guard；全 Controller 矩阵回归未完成 |
| 普通用户阻止工程入口 | REAL（代码级） | route meta + router guard；后端关键 API Guards |
| 生产禁止透明 Mock | REAL（请求层） | 生产构建门禁测试，API 错误不 fallback |
| 五主导航 | REAL | 首页、地图、作业、农事、我的 |
| 三端不同布局 | PARTIAL | CSS/构建通过；真实浏览器五视口 E2E BLOCKED |
| 工程师/超级管理员入口 | PARTIAL | 正式工作区已建；部分后端能力不存在或被配置阻断 |
| 危险操作流程 | PARTIAL | 阀门/设备控制基线已接入；其他危险 Controller 待统一 |
| 离线不伪造命令 | REAL | 非 GET 离线统一阻止，静态测试通过 |
| PWA 安装基础 | REAL（构建级） | manifest、图标、service worker、shell cache |
| 构建和关键测试 | PARTIAL | 两端构建/契约测试通过；ESLint/Playwright 阻断 |
| 未启真实设备/生产数据 | REAL | 未部署、未连接、未启用 |

Phase A 不能完成的主要原因：五视口真实浏览器验收未运行；全后端接口权限矩阵及越权集成测试不足；危险操作尚未覆盖禁用用户/设备和审批 Controller；旧页面仍有页面级 Demo 初始值。
