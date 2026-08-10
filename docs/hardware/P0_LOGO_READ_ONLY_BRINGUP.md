# P0 LOGO! 8.4 只读 Bring-up Procedure

## Preconditions

1. 完成首次通电 Checklist A–C；无未关闭的安全 NCR。
2. 台架与生产网络隔离，不存在到生产 PLC 的路由。
3. LOGO project 已读取备份并计算 SHA-256。
4. 六个软件安全门仍保持 MOCK/FAKE/禁止写状态。
5. 由官方手册和工程文件确认“允许读取”的点位；没有确认点位则只做 TCP health，不做地址扫描。

## Read-only sequence

```text
PC
  → ping LOGO IP
  → test TCP 502 reachability
  → Modbus TCP connect
  → healthCheck
  → read one confirmed point
  → compare with LOGO display / Soft Comfort online state
  → disconnect
  → archive evidence
```

1. 记录 PC 网卡、LOGO IP、子网及时间；确认目标就是铭牌对应的台架资产。
2. `ping` 仅证明 IP 可达，不证明 Modbus 或安全状态。
3. 测试 TCP 502，仅连接已记录 IP；禁止网段扫描。
4. 使用 transport 的 `connect()` 和 `healthCheck()`；记录连接/断开时间及错误。
5. 仅对人工确认的只读点调用 `readCoil`、`readDiscreteInput`、`readHoldingRegister` 或 `readInputRegister`。
6. 操作员在同一时间观察 LOGO display/Soft Comfort，将软件值、显示值和切换动作逐项记录。
7. 值不一致、类型不一致、超时、exception response 或 unit ID 不一致时立即停止；不得“试下一个常见地址”。
8. 调用 `disconnect()`，确认连接释放；保存日志、截图、project hash 和 commissioning record。

## Explicit prohibitions

- 禁止 `writeCoil`、`writeHoldingRegister` 及任何批量写。
- 禁止通过循环读取发现地址、猜测 Siemens VM/V/Q/I/M 映射或套用其他项目地址表。
- 禁止把临时测试地址写入 `logo-8.4.example.json`。
- 禁止接真实泵、VFD、电动阀或绕过 E-stop。

只读结果：`PASS / STOP`　证据目录：__________　复核人：__________
