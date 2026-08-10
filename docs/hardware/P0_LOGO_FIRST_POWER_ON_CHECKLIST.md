# P0 LOGO! 8.4 首次通电 Checklist

项目：__________　资产 ID：__________　日期：__________　负责人：__________

## A. 到货与断电检查

- [ ] 拍摄完整铭牌照片，照片可读且不包含网络密码。
- [ ] exact part number 为 `6ED1052-1MD08-0BA2`；不接受相似型号代替。
- [ ] 记录 serial number、hardware version；不从包装顺序推断。
- [ ] 获得该硬件版本适用的官方 datasheet、manual 和安全说明。
- [ ] 24 VDC 电源仍断电；确认额定输入、输出、PE/0V方案。
- [ ] 用万用表确认 +24 V/0 V 极性，导线无短路，对地方案符合签字图。
- [ ] 支路保险/断路器型号、DC额定和保护电流与线径匹配。
- [ ] E-stop 使用 NC 触点；断线应进入急停，不得用软件常量旁路。
- [ ] LOGO 输出端不接真实泵、VFD、电动阀或其他大功率负载。
- [ ] 首次上电时所有 Q 输出保持空载；LED 也在基本启动确认后逐路接入。

## B. 首次上电

- [ ] 由合格人员复核接线并签字：__________。
- [ ] 测量电源空载电压：__________ VDC。
- [ ] 接入 LOGO 后测量端子电压：__________ VDC；极性正确。
- [ ] 合上保护器件，观察无异味、异常温升、打火或反复重启。
- [ ] LOGO display 正常；记录启动页面、日期时间和诊断状态。
- [ ] 从 display/官方工具记录 firmware version，不猜测版本。
- [ ] 确认所有物理输出无意外动作。
- [ ] 断开/按下 E-stop，确认硬件安全状态；此时仍不执行 Modbus write。

## C. Ethernet 与工程备份

- [ ] 记录 Ethernet IP、subnet mask、gateway、MAC；确认处于隔离台架网段。
- [ ] PC 仅连接隔离台架 LAN，不连接生产网络。
- [ ] `ping` 结果和延迟已记录；ping 失败时先排查二层/IP，不扫描其他网段。
- [ ] 使用已记录版本的 LOGO!Soft Comfort 建立连接。
- [ ] 在任何修改前读取并备份现有 project；计算备份 SHA-256。
- [ ] 记录 project version、程序名、保护状态和最后修改时间。
- [ ] 禁止把密码、授权码或私密工程凭据写入 Git。

## D. Modbus 只读确认

- [ ] 从 LOGO/Soft Comfort/官方文档确认 Modbus TCP 是否启用。
- [ ] 记录 LOGO 的 Server/Client 模式；不根据 TCP 502 开放状态猜测。
- [ ] 记录 unit ID；若该模式不使用 unit ID，记录官方说明页。
- [ ] 保存 Modbus access configuration 截图/导出及手册版本。
- [ ] 只测试 TCP connect、healthCheck 和经确认点位的 read。
- [ ] 每个读取值与 LOGO display/Soft Comfort online state 人工对比。
- [ ] 第一次通信测试明确禁止 `writeCoil` 和 `writeHoldingRegister`。
- [ ] 未确认地址不得通过扫描、递增尝试或“常见 LOGO 地址”探测。

## E. LED 低压输出准备

- [ ] 只在项目备份、E-stop 和保护检查完成后接入 24 V LED。
- [ ] 每路 LED 有独立标签和合适保护；先断电接线，再复测极性。
- [ ] Q1–Q4 仍只是建议逻辑分配，须与实际工程和输出类型一致。
- [ ] 输出测试前另行取得用户明确批准；本 Checklist 不构成写入授权。

## F. 软件安全门

- [ ] `DEVICE_CONTROL_MODE=MOCK`
- [ ] `DEVICE_CONTROL_DRY_RUN=true`
- [ ] `VALVE_ALLOW_REAL_CONTROL=false`
- [ ] `ENABLE_AUTO_EXECUTION=false`
- [ ] `PLC_TRANSPORT=FAKE`
- [ ] `PLC_REAL_WRITE_ENABLED=false`
- [ ] REAL hardware gate 截图/配置核对证据已保存。

首次通电结论：`PASS / CONDITIONAL / STOP`　异常/NCR：____________________
