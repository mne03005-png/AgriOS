# P0 LOGO! 8.4 第一批低压桌面台架冻结

日期：2026-08-10。目标是准备无泵、无 VFD、无真实阀的 24 VDC 台架。所有控制输出首先只接 LED 或接口继电器，真实硬件写入保持关闭。

## 第一批设备

| 项目 | 数量 | 冻结要求 | 用途 | 到货状态 |
|---|---:|---|---|---|
| Siemens LOGO! 8.4 12/24RCE | 1 | 订货号 `6ED1052-1MD08-0BA2`；实物铭牌、硬件和固件待记录 | 主 PLC | 未确认 |
| 24 VDC DIN 电源 | 1 | 2.5–5 A，SELV/PELV，短路/过流保护，规格与接线图齐全 | 台架电源 | 未确认 |
| 急停按钮 | 1 | 保持式，NC 常闭触点；断线视为急停 | 硬件安全输入 | 未确认 |
| DI 模拟开关/按钮 | ≥5 | 24 VDC 适用，有清晰 ON/OFF 标识 | 模拟缺水、反馈、过载 | 未确认 |
| 24 VDC LED 指示灯 | 4 | 低功率、极性和额定电流明确 | 模拟阀、泵和告警输出 | 未确认 |
| DIN 导轨/端子/保护/线材 | 1套 | 支路保险或断路器、PE/0V端子、线号、端套、网线 | 安全配线 | 未确认 |

第一阶段明确不需要：UG65、UC300、LoRa sensor、真实泵、真实 VFD、真实电动阀、压力/流量传感器、Raspberry Pi、ChirpStack。

## 建议逻辑 I/O（非最终地址）

| 建议端子 | logicalName | 台架信号 | 默认安全状态 | 最终确认状态 |
|---|---|---|---|---|
| I1 | emergency_stop | NC 急停 | 断线/失电=ACTIVE | UNCONFIRMED |
| I2 | no_water | DI 模拟开关 | 断线/失电=NO_WATER | UNCONFIRMED |
| I3 | valve_open_feedback | DI 模拟开关 | 未到位 | UNCONFIRMED |
| I4 | valve_close_feedback | DI 模拟开关 | 关闭状态由工程确认 | UNCONFIRMED |
| I5 | pump_running_feedback | DI 模拟开关 | NOT_RUNNING | UNCONFIRMED |
| I6 | overload_trip | NC 模拟开关 | 断线/失电=TRIP | UNCONFIRMED |
| Q1 | valve_open_command | 24 V LED | OFF | UNCONFIRMED |
| Q2 | valve_close_command | 24 V LED | OFF/安全关阀逻辑待工程确认 | UNCONFIRMED |
| Q3 | pump_start_command | 24 V LED | OFF | UNCONFIRMED |
| Q4 | alarm/status | 24 V LED | 项目定义待确认 | UNCONFIRMED |

`I1… I6`、`Q1…Q4` 只是第一版 LOGO! 端子建议，不是 Siemens VM/V/Q/I/M Modbus 地址，也不得自动换算为 coil/register。只有实物、LOGO!Soft Comfort 工程和官方文档三方核对后才能冻结。
