# P0 真实硬件资料缺口与用户确认清单

## 必须取得的官方资料

| 组件 | exact model / firmware | 必需资料 | 当前状态 | 解除条件 |
|---|---|---|---|---|
| PLC/UC300 | UC300-470M 候选；固件未知 | user guide、LoRaWAN communication protocol、Modbus/RS485说明、DI/DO/AI wiring、下行命令/ACK定义 | 部分官方系列资料已找到 | 订单 SKU、铭牌、固件与对应版本文档一致 |
| 本地 PLC | LOGO! 8.4 12/24RCE 候选 | datasheet、manual、I/O wiring、Ethernet protocol、程序/版本管理 | 未收集到项目证据包 | exact order code 和签字安全程序确定 |
| Gateway | UG65 中国频段候选；固件未知 | datasheet、user guide、CN470 channel plan、embedded NS、MQTT API、TLS、backup/restore | 官方系列资料已找到 | exact SKU/firmware 与现场功能逐项验证 |
| 4G Router | UR35 中国 LTE 候选 | exact cellular SKU、频段、SIM/failover、VPN、供电与接地手册 | 官方 datasheet 已找到；项目 SKU 未确认 | 供应商书面确认中国网络兼容性 |
| 土壤传感器 | LSE01-CN470-8 候选 | user guide、payload decoder、频段、量程、精度、电池、土壤校准 | 官方产品页、资料目录和校准资料已找到 | exact SKU 与 decoder 版本验证 |
| 压力传感器 | 未定 | datasheet、量程、精度、4–20mA/RS485 wiring、校准、register map | 缺失 | 选型并取得全套资料 |
| 流量计 | Signet 2536 候选 | exact size/order code、K-factor、pulse wiring、直管段、校准证书 | 缺订单级资料 | 管径/流量范围冻结 |
| 阀 | Bürkert 6213 候选 | voltage、drive method、介质、压差、fail position、duty cycle、feedback contacts | 缺失 | exact ordering code + 独立阀位方案 |
| 泵 | 未定 | 铭牌、泵曲线、电压、启动电流、控制模式、最小流量、防干转 | 缺失 | 水力计算签字后选型 |
| 接触器/VFD | TeSys D/LRD 候选；VFD未定 | coil、电流等级、overload、aux contact；VFD control/fault/Modbus map | 缺失 | 与泵铭牌匹配并签字 |
| E-stop | XB5AS8442 系列候选 | exact contact blocks、NC wiring、安全回路和复位原则 | 缺失 | 持证电气负责人批准 |
| 24 V 电源 | 未定 | SELV/PELV、输入输出、保护、纹波、降额、接地 | 缺失 | 台架负载预算后选型 |

## 用户必须确认/购买

### A. 已确定到“历史候选”层级

UG65-470M/CN470、UC300-470M、LSE01-CN470-8、EM300-TH-470M、UR35 中国 LTE、Raspberry Pi 4B、LOGO! 8.4 12/24RCE。**没有任何一项有当前实物证据，因此均不是最终采购冻结。**

### B. 尚未确定型号

压力传感器、阀位反馈、泵、VFD（若使用）、低液位开关、24 V 台架电源、台架小阀/继电器、压力/流量信号模拟器。

### C. 必须优先找手册

UC300、UG65、UR35、LOGO!、最终压力/流量/液位传感器、阀、泵、接触器/VFD。没有官方 wiring/protocol/register map，不得接线或开发真实 transport。

### D. 必须采购的台架设备

24 V 电源与支路保护、E-stop、缺水/过载模拟开关、UC300/PLC、2–4 个接口继电器、泵指示灯负载、阀模拟负载、反馈触点、压力信号源、流量脉冲源、DIN端子配线和合格万用表。完整 LoRaWAN 闭环还需 UG65 和一个 CN470 节点。

### E. 可先由模拟器替代

真实水泵、真实管路阀、压力变送器、流量计、液位变送器、土壤探头、4G Router、现场 Edge。模拟器不能替代最终电气和协议验收。

### F. 何时可开发真实 transport

只有在 **UC300/PLC exact model + firmware + protocol guide + register/command map + wiring + ACK语义** 全部确认后，才能开发 `ModbusTcpTransport`、`ModbusRtuTransport` 或 `Uc300HttpTransport`。此前只允许 `FakePlcTransport`。

### G. ChirpStack

`CONDITIONAL`：最终 UG65 确认使用 embedded Network Server + MQTT(S) 时不需要；仅 packet forwarder 时需要。

### H. 台架类别数量

最少约 **15 类核心设备/器材**；完整 LoRaWAN 闭环约 17 类。见 `P0_BENCH_BOM.md`。

### I. 是否可进入真实接线

**NO**。可以采购和盘点资料，可以搭建断电的机械/DIN布局；在 exact SKU、接线图、I/O电气参数和安全回路批准前，不得通电接入真实控制器或执行器。
