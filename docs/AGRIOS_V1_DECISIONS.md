# AgriOS V1.0 架构决定记录

基线日期：2026-08-06。这里的“废弃”是目标状态，不授权本阶段删除代码或数据。

| ADR | 决定 | 保留 | 废弃/延后 | 原因与风险 | 恢复/迁移方案 |
|---|---|---|---|---|---|
| ADR-01 | Docker Compose 是唯一生产运行方式 | production compose、Dockerfile、健康检查 | PM2 双运行废弃 | 双实例会重复消费、占端口并产生状态漂移 | 归档 PM2 配置；仅在完整停 Docker 且审批后作灾难回退 |
| ADR-02 | gray 是 production 覆盖层 | 独立 project/network/volumes、安全开关 | gray 单文件启动废弃 | 单文件无 image/build，且错误叠加可能复用生产资源 | 固定双 `-f` 命令并加 CI 静态检查 |
| ADR-03 | 每环境一套 MySQL/Redis/Mosquitto | production 内置服务 | 主机/PM2 遗留重复实例 | 双写、错库、重复 MQTT 消费 | 盘点端口/卷后按停机清单迁移，不自动删除 |
| ADR-04 | MQTT Direct 为现场主通道 | Mosquitto TLS、规范 topic、ACK | ThingsBoard 直接控制延后/禁用 | 双控制面会绕过审批和审计 | ThingsBoard 保留只读诊断；控制统一经 AgriOS |
| ADR-05 | AgriOS MySQL 保存全部业务主数据 | Device 与 TB ID 映射、遥测副本 | TB 作为农场/地块主库废弃 | 同步冲突和不可追溯 | 一次性对账，TB 仅保留设备影子 |
| ADR-06 | BullMQ 是唯一生产队列 | QueueAdapter、DB job、重试/死信 | production memory queue 废弃 | 重启丢任务；错误配置可能产生两个消费者 | 启动时强制 BullMQ；用唯一 jobId 与 DB 状态锁防重 |
| ADR-07 | 生产 API 失败必须 fail closed | `isMock` 可用于开发提示 | 全局透明 fallback 废弃 | 401/500/断网会展示假数据并可能误导操作 | 增加 build-time production gate；Mock 仅显式 demo profile |
| ADR-08 | 一套响应式 Vue 前端覆盖三类屏幕 | `apps/mobile` 页面/API 基线 | web-admin/miniapp 空壳不并行开发 | 多壳造成角色、路由、修复重复 | 重命名/收敛后按角色路由与响应式布局扩展 |
| ADR-09 | Edge 必须是可部署、可版本化 Agent | EdgeGateway/Command 数据模型与 API | 仅云端“Edge 设计”不算交付 | 当前没有可审计的 Agent 运行证据 | 定义协议、存储、签名和升级契约后实现最小 Agent |
| ADR-10 | PLC 是最终安全权威 | 云端软件 Safety 预检、审批 | 云/AI 替代硬联锁禁止 | 网络/软件失效可能导致设备损坏 | 台架逐项验证联锁；云端只做更保守限制 |
| ADR-11 | 农事和 IoT 共用 Farm/Field/Zone 上下文 | 现有记录、成本、遥测模型 | 两套地块/作业标识废弃 | 时间线和成本无法闭环 | 统一 ID/事件模型并补关联迁移 |
| ADR-12 | 单一 DeviceControl gateway | 当前多 adapter 作为内部策略 | controller/service/MQTT/TB 各自直接控制废弃 | 权限、幂等和审计不一致 | 将 adapter 藏在 gateway 后，统一 command envelope |
| ADR-13 | V1 只采用本文件的 A-G backlog | 有证据的既有实现 | Phase 5/6/11…30 的路线编号废弃 | 多套 Phase 相互矛盾且造成虚假成熟度 | 历史文档只读归档，任务映射到 A-G |
| ADR-14 | 本次本地修改全部保留 | 14 个既有修改及未跟踪交付物 | 不在审计阶段合并或回退 | 其中含 auth/queue/control/gray，未经完整回归 | 后续按文件分组审查、测试、独立提交 |
| ADR-15 | V1 停止电商/支付/无人机 AI 等扩张 | 与洋葱 Zone 直接有关的代码 | Billing、复杂 Drone/AI 等不进入 V1 入口 | 范围过宽稀释现场闭环 | 保留代码但关闭入口；V1 验收后重新评估 |

## 不可逆操作原则

本阶段未删除任何实现。后续“废弃”先经过依赖扫描、数据导出、功能开关关闭、一个版本观察期，再删除；数据库字段/表必须先停止写入并保留可验证恢复备份。
