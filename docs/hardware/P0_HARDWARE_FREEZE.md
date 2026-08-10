# P0 真实硬件、协议与型号冻结表

日期：2026-08-10。状态含义：`历史候选` 仅表示仓库曾规划，不代表已采购；`待确认` 表示必须以订单、铭牌和官方手册闭环后才能冻结。

## 仓库历史结论

Phase27–30 曾规划 Milesight UR35、UG65-470M、UC300-470M、EM300-TH-470M，Dragino LSE01-CN470-8、Raspberry Pi 4B、Siemens LOGO! 8.4 12/24RCE、Phoenix Contact 接口继电器及若干执行器。早期 ESP32/SX1262、自组 LoRa、私有 LoRa 网关属于替代候选，与标准 LoRaWAN 方案功能重叠；桌面台架不需要太阳能、室外箱、双 SIM 和大功率泵，以上仅在现场部署需要。

## 冻结矩阵

| 设备类别 | 候选型号 / 厂商 | 用途与供电 | 通信；上行 / 下行 | Modbus | LoRaWAN / 自带 NS / ChirpStack | I/O（官方或待确认） | 反馈方式 | 台架 / 现场 | 当前确认状态 | 官方资料状态 |
|---|---|---|---|---|---|---|---|---|---|---|
| 土壤湿度传感器 | LSE01-CN470-8 / Dragino | 土壤水分、温度、EC；电池 | LoRaWAN uplink；配置 downlink | 否 | 是 / 否 / 依赖网关 | 无外部 I/O | LoRaWAN payload | 可选 / 必须 | 历史明确候选，未确认实物 | 产品页已找到；须取得该 SKU 手册、decoder、校准资料 |
| 压力传感器 | **型号未定** | 台架模拟压力；通常 24 VDC | 4–20 mA 或 RS485 上行；无控制下行 | 条件 | 否 / 否 / 否 | AI 或 RS485 | 模拟量/寄存器 | 模拟器必需，真传感器可选 / 必须 | 待选型 | 缺 exact model、量程、精度、接线和 register map |
| 流量计 | GF Signet 2536 Rotor-X DN25 + 3-2536-P0（历史候选） | 流量/累计量；供电待订单确认 | 脉冲上行；无控制下行 | 历史候选否 | 否 / 否 / 否 | DI pulse | 脉冲/K-factor | 信号模拟器可代替 / 必须 | 历史候选，未确认管径和实物 | 缺订单级 datasheet、K-factor 证书、接线图 |
| 电动阀 | Bürkert 6213 EV DN25 24 VDC NC（历史候选） | 单 Zone 开关阀；24 VDC | 继电器/接触器下行 | 否 | 否 / 否 / 否 | DO 驱动 | 本体不等同阀位反馈 | 小型 24 V 阀或继电器必需 / 必须 | 介质、压差、线圈和实际型号未确认 | 缺 exact ordering code、线圈浪涌和压力曲线 |
| 阀位反馈 | **型号未定**限位开关/辅助触点 | 开/关到位；通常干接点 | DI 上行 | 否 | 否 / 否 / 否 | 2 DI 推荐 | open/close 独立反馈 | 必须 / 必须 | 未定 | 缺触点类型、防护等级和接线图 |
| 水泵 | **型号未定；台架禁止接大功率泵** | 输水；电源取决于泵曲线 | 由接触器/VFD控制 | 条件 | 否 | 间接 I/O | running/fault/flow/pressure | 指示灯模拟 / 必须 | 未完成水力选型 | 缺泵曲线、铭牌、启动电流和保护要求 |
| 接触器或 VFD | 接触器：TeSys D + LRD（历史候选）；VFD 型号未定 | 隔离泵动力回路 | DI/DO；VFD 可 RS485 | 条件 | 否 | coil/start/stop，running/fault | 辅助触点或 Modbus | 继电器/灯模拟 / 现场泵需要 | 仅接触器系列候选 | exact current rating、coil、VFD map 均待确认 |
| PLC / 控制器 | UC300-470M / Milesight；LOGO! 8.4 12/24RCE 为本地安全 PLC 候选 | I/O 汇聚和本地安全状态机；UC300 12–24 VDC（按官方 datasheet） | LoRaWAN 或 RS485；命令 downlink | UC300 支持 RS485 Modbus | UC300 是 / 否 / 依赖网关 | UC300 官方：4 DI、2 relay DO、6 AI、1 RS485、1 RS232 | DI/AI/RS485 + LoRaWAN ACK | 必须 / 必须 | 型号为历史明确候选，未有铭牌/固件 | UC300 产品页、datasheet、文档中心已核验；通信协议和订单 SKU 尚缺 |
| LoRaWAN Gateway | UG65 Global/CN470 配置 / Milesight | 8-channel LoRaWAN 汇聚；9–24 VDC/PoE（官方） | LoRaWAN↔MQTT(S)/HTTP(S) | 官方支持 Modbus 集成 | 是 / **是** / `CONDITIONAL` | 非现场 PLC I/O | MQTT PUBACK、设备状态 | 有 LoRa 节点时必需 / 必须 | 历史明确候选，频段/SKU/实物未确认 | 官方 datasheet 确认 embedded NS、MQTT(S)、HTTP(S) |
| 4G Router | UR35 中国 LTE 版本 / Milesight | 现场 WAN 回传 | Ethernet↔LTE/VPN | 非本轮依赖 | 否 | 型号细分待确认 | 链路健康/双 SIM 状态 | 非必需 / 必须 | 历史候选，精确 SKU 未定 | 需中国版本 datasheet、频段、双 SIM 和供电手册 |
| Edge Computer | Raspberry Pi 4B 4 GB + SSD（历史候选） | MQTT/缓存/适配；5 VDC | Ethernet；MQTT(S)/HTTP(S) | 通过软件条件支持 | 否 | USB/Ethernet；不直接承担安全 I/O | 服务健康/队列 | 可用开发机替代 / 现场建议必需 | 候选，未确认现有资产 | 官方硬件资料易得；需资产/电源/SSD确认 |
| E-stop | Harmony XB5AS8442，2NC（历史候选） | 硬接线急停 | PLC DI + 接触器安全回路 | 否 | 否 | 至少 1 DI，双通道方案由电气设计决定 | NC 回路，断线视为急停 | 必须 / 必须 | 候选，安全架构未签字 | 缺 exact contact block 与安全回路图 |
| 缺水/液位输入 | 24 VDC 投入式液位 4–20 mA（历史候选）+ 独立低液位开关待选 | 防干转 | AI 和安全 DI | 条件 | 否 | 1 AI + 建议 1 fail-safe DI | 低液位 NC / 4–20 mA | 开关/电阻模拟必需 / 必须 | 未定型 | 缺量程、探头、触点和校准资料 |
| 24 VDC 电源 | **台架电源型号未定** | 隔离低压供电 | 无 | 否 | 否 | 额定电流按负载预算 | 电压/过流状态 | 必须 / 必须 | 未定 | 需 SELV/PELV、短路保护、纹波和认证资料 |
| 台架测试负载 | 24 VDC 指示灯 + 小型继电器/小阀 | 模拟 pump/valve 输出 | DO 与反馈 DI | 否 | 否 | 2–4 DO、反馈触点 | 辅助触点 | 必须 / 否 | 规格级冻结，型号待采购 | 通用元件 datasheet 随采购取得 |

官方依据：Milesight [UC300 产品页](https://www.milesight.com/iot/product/iot-controller/uc300)、[UC300 datasheet](https://resource.milesight.com/milesight/iot/document/uc300-datasheet-en.pdf)、[UG65 产品页](https://www.milesight.com/iot/product/lorawan-gateway/ug65)、[UG65 datasheet](https://resource.milesight.com/milesight/iot/document/ug65-datasheet-en.pdf)、[UR35 datasheet](https://resource.milesight.com/milesight/iot/document/ur35-datasheet-en.pdf)、[EM300-TH datasheet](https://resource.milesight.com/milesight/iot/document/em300-th-datasheet-en.pdf)、[Milesight 文档中心](https://www.milesight.com/support/resources/document-center)，以及 Dragino [LSE01 产品页](https://www.dragino.com/products/agriculture-weather-station/item/159-lse01.html)和[资料目录](https://www.dragino.com/downloads/index.php?dir=LoRa_End_Node%2FLSE01%2F)。这些资料只能证明产品系列能力，不能替代实购 SKU、固件和铭牌确认。

## ChirpStack 判定

当前结论：**CONDITIONAL**。

- 若最终为支持 embedded Network Server、OTAA/ABP、device profile 和 MQTT(S) integration 的 UG65 版本：P0/单 Zone 阶段 `ChirpStack = NOT REQUIRED`。
- 若最终网关仅运行 packet forwarder，或决定将 Network Server 独立托管：`ChirpStack = REQUIRED`。
- 在 gateway exact SKU、固件和 MQTT API 验证前不得将 CONDITIONAL 改为最终结论。

## 未来 transport 边界

P0-1 的 `PlcControllerPort` 可以承载命令、安全结果和反馈，但真实厂商通信必须再由独立 `PlcTransportPort` 隔离。候选实现为 `ModbusTcpTransport`、`ModbusRtuTransport`、`Uc300HttpTransport` 和仅测试使用的 `FakePlcTransport`。transport 只负责连接、读写和超时，不得自行绕过 commandId、ActionQueue、安全联锁或审计。本轮不新增接口代码，也不实现任何厂商细节；exact model、protocol 和 register/command map 三项齐全后再设计方法签名。

## 冻结结论

真实接线：**NO**。目前只允许购买安全低压台架元件并按厂家说明进行无负载验收；UC300/PLC、网关、传感器、阀和泵的 exact model/firmware/manual 尚未形成完整证据包。
