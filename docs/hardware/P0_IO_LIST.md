# P0 单 Zone 逻辑 I/O 点表

本表只冻结逻辑点和安全语义，不是端子图或寄存器表。所有物理地址、function code、极性和电气参数必须等待 exact model 官方手册与签字接线图。

| 类型 | logicalName | 方向 | 正常/安全语义 | 用途 | 物理实现状态 |
|---|---|---|---|---|---|
| DI | emergency_stop | 输入 | NC；断线/失电视为 ACTIVE | 硬切泵许可并锁存故障 | UNCONFIRMED |
| DI | no_water | 输入 | NC；断线视为 NO_WATER | 禁止泵启动/运行 | UNCONFIRMED |
| DI | valve_open_feedback | 输入 | 独立到位触点 | 允许 pump_start 的必要条件 | UNCONFIRMED |
| DI | valve_close_feedback | 输入 | 独立到位触点 | 证明安全关闭 | UNCONFIRMED |
| DI | pump_running_feedback | 输入 | 接触器辅助触点或 VFD 状态 | 启停确认 | UNCONFIRMED |
| DI | overload_trip | 输入 | NC；断线视为 TRIP | 立即停泵并要求人工复位 | UNCONFIRMED |
| DI | flow_pulse | 输入 | 电平/频率待手册确认 | 瞬时/累计流量（若选脉冲表） | UNCONFIRMED |
| DO | valve_open | 输出 | 上电默认 OFF | 开阀请求 | UNCONFIRMED |
| DO | valve_close | 输出 | 上电策略取决于双线/三线阀 | 关阀请求 | UNCONFIRMED |
| DO | pump_start | 输出 | 上电默认 OFF | 泵运行许可/接触器或 VFD start | UNCONFIRMED |
| DO | pump_stop_or_reset | 输出 | STOP 优先；reset 不得自动触发 | 具体是 stop 还是 reset 由设备决定 | UNCONFIRMED |
| AI | pressure | 输入 | 断线/越界为故障 | 压力联锁与趋势 | UNCONFIRMED；预计 4–20 mA |
| AI | flow_rate | 输入 | 越界为故障 | 若采用模拟量流量计 | UNCONFIRMED |
| AI | water_level | 输入 | 低位阻断启动 | 连续液位 | UNCONFIRMED；可不采用 |
| RS485 | vfd | 双向 | 通信失联禁止启动；stop 保留硬线 | 转速、运行、故障 | UNCONFIRMED |
| RS485 | flow_meter | 输入 | 超时标记质量失败 | 流量/累计量 | UNCONFIRMED |
| RS485 | pressure_transmitter | 输入 | 超时视为不可用于启动 | 压力 | UNCONFIRMED |
| RS485 | other_modbus_device | 双向 | 默认只读；写入需单独审批 | 预留 | UNCONFIRMED |

## 顺序与联锁

启动：`valve_open → valve_open_feedback → safety inputs healthy → pump_start → pump_running_feedback → pressure/flow valid`。

停止：`pump_stop → pump_running_feedback=OFF → valve_close → valve_close_feedback`。

任一超时、反馈矛盾、急停、缺水、过载或控制器离线均进入 fail-safe；PLC/硬接线是最终安全权威。`pump_stop_or_reset` 在设备手册确认前不得映射，自动 reset 永久禁止。
