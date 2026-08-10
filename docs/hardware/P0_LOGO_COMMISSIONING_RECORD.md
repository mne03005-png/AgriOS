# P0 LOGO! 8.4 Commissioning Record

所有空白必须来自实物、官方工具或官方文档。未核验字段填写 `UNCONFIRMED`，不得用网络示例补齐。

## Identity and network

| Field | Recorded value | Evidence reference | Verified by/date |
|---|---|---|---|
| partNumber | `6ED1052-1MD08-0BA2`（待铭牌核验） | UNCONFIRMED | UNCONFIRMED |
| serialNumber | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| hardwareVersion | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| firmwareVersion | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| ipAddress | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| subnetMask | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| gateway | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| MAC | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| LOGOSoftComfortVersion | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| projectVersion | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| projectBackupSHA256 | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| modbusEnabled | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| modbusMode | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| unitId | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| officialManualVersion | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| commissionedBy | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| commissionedDate | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |

## DI mapping

| Proposed terminal | logicalName | Electrical semantics | Project symbol/block | Confirmed terminal | Evidence | Status |
|---|---|---|---|---|---|---|
| I1 | emergency_stop | NC/fail-safe proposed | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| I2 | no_water | NC/fail-safe proposed | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| I3 | valve_open_feedback | dry contact proposed | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| I4 | valve_close_feedback | dry contact proposed | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| I5 | pump_running_feedback | auxiliary contact proposed | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| I6 | overload_trip | NC/fail-safe proposed | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |

## DO mapping

| Proposed terminal | logicalName | Test load | Project symbol/block | Confirmed terminal | Evidence | Status |
|---|---|---|---|---|---|---|
| Q1 | valve_open_command | 24 V LED only | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| Q2 | valve_close_command | 24 V LED only | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| Q3 | pump_start_command | 24 V LED only | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| Q4 | alarm/status | 24 V LED only | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |

## VM and Modbus mapping

| logicalName | LOGO project variable | VM/V/Q/I/M reference | Modbus object/function | address | data type/scale | official manual page | two-person verification | Status |
|---|---|---|---|---|---|---|---|---|
| emergency_stop | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| no_water | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| valve_open_feedback | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| valve_close_feedback | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| pump_running_feedback | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| overload_trip | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| valve_open_command | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| valve_close_command | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| pump_start_command | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |
| alarm/status | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED | UNCONFIRMED |

记录完成不等于批准写入。只有真实 profile gate 全部通过并取得用户单独批准后，软件写入门才可变更。
