# P0 单 Zone 最小桌面台架 BOM

目标链路：传感器/模拟器 → Gateway/MQTT → AgriOS → ActionQueue → PLC/UC300 → 24 V 安全负载 → feedback → ACK。第一版禁止连接大功率水泵。

| 设备 | 数量 | 最低规格 | 候选型号 | 必须/可选 | 预计接口 | 用途 | 是否已有 | 缺少资料 |
|---|---:|---|---|---|---|---|---|---|
| PLC/IoT Controller | 1 | ≥4 DI、≥2 DO、AI、RS485；24 V；本地规则 | UC300-470M | 必须 | DI/DO/AI/RS485/LoRaWAN | 控制与反馈 | 未确认 | SKU、固件、protocol、wiring |
| 本地安全 PLC | 1 | 24 V、硬接线联锁、Ethernet维护 | LOGO! 8.4 12/24RCE | 可选但强烈建议 | DI/DO/Ethernet | 最终安全状态机 | 未确认 | exact order code、程序设计 |
| LoRaWAN Gateway | 1 | CN470、embedded NS、MQTT(S) | UG65 对应中国频段 SKU | LoRaWAN链路必须 | LoRaWAN/Ethernet/MQTT | OTAA、上下行 | 未确认 | exact SKU/firmware/API |
| Edge/开发机 | 1 | 可运行本地 mock MQTT/adapter；有线网 | 现有开发机或 Raspberry Pi 4B | 必须 | Ethernet | 本地协议桥和日志 | 开发机可用 | 现场资产待定 |
| 24 VDC SELV/PELV 电源 | 1 | 隔离、短路/过流保护，建议 ≥5 A | 待选 | 必须 | 24 V bus | 安全台架供电 | 未确认 | 认证、纹波、端子图 |
| DC 断路/熔断器 | 1套 | 每支路独立保护，DC额定 | 待选 | 必须 | 电源支路 | 保护导线和设备 | 未确认 | 分断能力/选型计算 |
| E-stop | 1 | 蘑菇头、保持、至少 2NC | XB5AS8442 系列候选 | 必须 | safety DI + 硬回路 | 急停 | 未确认 | 触点块 order code |
| 缺水开关模拟 | 1 | NC 干接点；断线为缺水 | 带保持测试开关 | 必须 | DI | 防干转联锁 | 未确认 | 触点约定 |
| 过载跳闸模拟 | 1 | NC 干接点 | 带保持测试开关 | 必须 | DI | overload_trip | 未确认 | 触点约定 |
| 24 V 指示灯 | 1 | 低功率、有明确极性 | 待选 | 必须 | pump_start DO | 模拟泵输出 | 未确认 | 额定电流 |
| 24 V 接口继电器 | 2–4 | 24 VDC coil、辅助触点、续流保护 | PLC-RSC-24DC/21 候选 | 必须 | DO→coil，contact→DI | 模拟阀/反馈及隔离 | 未确认 | coil current/contact rating |
| 24 V 小型常闭阀 | 1 | 安全低压、小流量、允许干台架动作 | 待选 | 可选 | DO + 独立反馈 | 更真实的阀动作 | 未确认 | duty cycle/feedback |
| 压力信号模拟器 | 1 | 4–20 mA，隔离或明确共地 | 校准信号源/可调电阻仅按输入手册 | 必须 | AI | pressure | 未确认 | UC300 AI wiring/range |
| 液位信号模拟器 | 1 | 4–20 mA 或 fail-safe DI | 同上 | 可选 | AI/DI | water_level | 未确认 | 输入方案 |
| 流量脉冲模拟器 | 1 | 干接点/开集电极可配置 | 函数/脉冲发生器 | 必须 | DI pulse | flow_rate | 未确认 | DI频率/电平 |
| 土壤传感器 | 1 | CN470 OTAA、有 decoder | LSE01-CN470-8 | 可选；端到端无线测试需要 | LoRaWAN | 真实 telemetry | 未确认 | decoder/calibration |
| 工业 Ethernet 交换/网线 | 1套 | 隔离测试 LAN | 现有交换机可替代 | 按拓扑 | Ethernet | Gateway/Edge互联 | 待盘点 | 端口/供电 |
| DIN 导轨、端子、线号、PE | 1套 | 指触安全、20%备用端子 | 待选 | 必须 | 配线 | 可审计接线 | 未确认 | 接线图 |
| 万用表 | 1 | CAT等级匹配、校准有效 | 现有仪表 | 必须 | 测量 | 上电前检查 | 待盘点 | 校准状态 |

最少涉及 **15 类核心设备/器材**（不含工具和可选真实传感器）。可先用模拟器替代压力、液位、流量、土壤传感器和真实阀；Gateway 可在纯 PLC I/O 台架阶段暂缓，但完整 LoRaWAN→MQTT 闭环必须补齐。
