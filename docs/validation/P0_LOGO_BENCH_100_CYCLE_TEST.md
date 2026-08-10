# P0 LOGO! 8.4 低压台架 100 Cycle 验收计划

本计划只适用于完成真实 profile Gate 后的 24 V LED/接口继电器台架，不允许连接泵、VFD或真实电动阀。执行前仍需用户单独批准写入窗口。

## Test allocation

| 场景 | 次数 | 预期 |
|---|---:|---|
| valve open/close | 20 | 每次先开后反馈、再关后反馈，无错序 |
| pump start/stop | 20 | 阀开反馈后才允许 start；STOP 完成 |
| duplicate command | 10 | 相同 commandId 不产生第二次输出动作 |
| delayed ACK | 10 | 延迟在阈值内正确关联，过期不改变最终状态 |
| timeout | 10 | 进入 TIMEOUT/fail-safe，无悬挂执行 |
| disconnect/reconnect | 10 | 失联禁止 START；恢复不自动重放危险命令 |
| emergency stop | 5 | 硬件急停立即阻断，软件不能旁路 |
| no-water | 5 | pump start 被阻断；运行时进入安全停止 |
| overload | 5 | 停泵、锁存、禁止自动 reset |
| feedback mismatch | 5 | 命令失败并告警，不继续后续动作 |
| **Total** | **100** | |

## Per-cycle record

| cycle | scenario | commandId | issuedAt | sentAt | PLC response | feedback | ACK | result | latencyMs | duplicateExecution | safetyResult | operator/evidence |
|---:|---|---|---|---|---|---|---|---|---:|---|---|---|
| 001 | | | | | | | | | | | | |

按 001–100 连续编号记录，不删除失败行；重测使用新 cycle，原失败保留。原始 transport 日志、LOGO trace/online state、视频或 LED 时间戳与表格 evidence ID 对应。

## Execution phases

1. 断电复核和安全门快照。
2. 只读基线：DI/DO显示与软件读取一致。
3. 用户批准一个受控 LED-only 写窗口。
4. 先执行 STOP/E-stop/no-water 负向用例，再执行正常顺序。
5. 每 20 cycle 检查温升、端子、日志缺口和 commandId 唯一性。
6. 结束时执行 STOP、确认所有 Q 安全、关闭写门并归档配置。

## Acceptance criteria

- `duplicate physical execution = 0`
- `unsafe pump start = 0`
- `lost STOP command = 0`
- `unhandled timeout = 0`
- 100/100 cycle 均有 commandId、时间、PLC response、feedback、ACK、result 和安全结果证据。
- 任何急停、缺水或过载失败均为整批 `REJECT`，不能通过重跑隐藏。

结论：`PASS / REJECT`　执行人：__________　复核人：__________　日期：__________
