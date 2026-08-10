# UC300 / PLC register mapping template

禁止把逻辑序号、数组下标或示例值当成厂商寄存器地址。官方协议未核验前，`address` 和 `functionCode` 必须保持 `UNCONFIRMED`。

| logicalName | device | protocol | unitId | functionCode | address | dataType | scale | unit | readWrite | normalValue | alarmValue | feedbackPoint | timeoutMs | retry | failSafeState | officialManualPage | verifiedBy | verifiedDate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| emergency_stop | exact model pending | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | boolean | UNCONFIRMED | state | R | inactive | active/open-circuit | hardwired E-stop loop | UNCONFIRMED | UNCONFIRMED | PUMP_OFF | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| no_water | exact model pending | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | boolean | UNCONFIRMED | state | R | water_available | no_water/open-circuit | low-level safety input | UNCONFIRMED | UNCONFIRMED | PUMP_OFF | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| valve_open_feedback | exact model pending | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | boolean | UNCONFIRMED | state | R | commanded state | mismatch | open limit contact | UNCONFIRMED | UNCONFIRMED | BLOCK_PUMP | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| valve_close_feedback | exact model pending | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | boolean | UNCONFIRMED | state | R | commanded state | mismatch | close limit contact | UNCONFIRMED | UNCONFIRMED | PUMP_OFF | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| pump_running_feedback | contactor/VFD pending | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | boolean | UNCONFIRMED | state | R | commanded state | mismatch | auxiliary contact/VFD status | UNCONFIRMED | UNCONFIRMED | PUMP_OFF | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| overload_trip | overload relay pending | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | boolean | UNCONFIRMED | state | R | healthy | trip/open-circuit | overload NC | UNCONFIRMED | UNCONFIRMED | PUMP_OFF_LATCH | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| valve_open | valve/relay pending | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | boolean | UNCONFIRMED | command | W | OFF | feedback timeout | valve_open_feedback | UNCONFIRMED | UNCONFIRMED | OUTPUT_OFF | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| valve_close | valve/relay pending | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | boolean | UNCONFIRMED | command | W | OFF | feedback timeout | valve_close_feedback | UNCONFIRMED | UNCONFIRMED | SAFE_CLOSE | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| pump_start | contactor/VFD pending | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | boolean | UNCONFIRMED | command | W | OFF | feedback timeout | pump_running_feedback | UNCONFIRMED | UNCONFIRMED | OUTPUT_OFF | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| pump_stop_or_reset | contactor/VFD pending | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | boolean | UNCONFIRMED | command | W | STOP | reset prohibited until approved | pump_running_feedback | UNCONFIRMED | UNCONFIRMED | STOP | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| pressure | transmitter pending | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | kPa | R | commissioned range | high/low/invalid | local calibrated gauge | UNCONFIRMED | UNCONFIRMED | BLOCK_START | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| flow_rate | meter pending | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | m3/h | R | commissioned range | zero/high/invalid | calibrated volume/time | UNCONFIRMED | UNCONFIRMED | STOP_AFTER_DELAY | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| water_level | transmitter pending | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | % or m | R | above minimum | low/invalid | independent no_water DI | UNCONFIRMED | UNCONFIRMED | BLOCK_START | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |

每一行只有在 `officialManualPage`、`verifiedBy`、`verifiedDate` 齐全，并由另一人对照实物读回后才可标记为 VERIFIED。
