# P0 LOGO! 8.4 REAL Profile 生成流程

当前禁止创建真实 profile。源模板仅为 `logo-8.4.example.json`，其中地址必须保持 `null`。

## 必需证据 Gate

- [ ] 实物铭牌清晰，part number 为 `6ED1052-1MD08-0BA2`，serial number 已登记。
- [ ] hardware/firmware version 由设备或官方工具读取。
- [ ] LOGO!Soft Comfort project 已备份，版本和 SHA-256 已登记。
- [ ] 获得适用于该 firmware/Soft Comfort 版本的 Siemens 官方 Modbus 文档。
- [ ] 实际 DI/DO、VM及程序变量配置已从工程文件核对。
- [ ] 每条 Modbus mapping 有 logicalName、对象类型、地址、数据类型、读写属性、官方手册页。
- [ ] mapping 已由两人分别对照工程、手册和只读结果核验。
- [ ] E-stop、保护器件及 LED-only 输出接线审查通过。
- [ ] commissioning record 和只读 bring-up 均为 PASS。
- [ ] 用户对生成 profile 作出明确批准；批准不等于批准真实写入。

任一项缺失：`PROFILE GENERATION = BLOCKED`。

## Generation and review

1. 从已提交的 `logo-8.4.example.json` 复制，不直接覆盖模板。
2. 文件名严格为 `logo-8.4-6ED1052-1MD08-0BA2-<firmware>.json`；firmware 必须是实读值。
3. 只录入证据表中已 VERIFIED 的点；不得填充连续地址或推断空缺。
4. 写点必须同时有独立反馈点和 fail-safe 定义；没有反馈的点不得用于自动执行。
5. schema/加载器必须拒绝 null、UNCONFIRMED、重复地址、错误类型、越界值和缺失证据。
6. 由电气负责人、LOGO 工程负责人、AgriOS 负责人完成三方 review。
7. 提交 profile 时附 commissioning record、手册版本和 project hash；不提交密码或受限工程凭据。
8. 合并 profile 后仍保持 `PLC_REAL_WRITE_ENABLED=false`，另开受控任务批准 LED-only 写测试。

## Rollback

任何 mapping/firmware/project 变化都使 profile 失效。恢复到 MOCK/FAKE、禁止写，重新执行证据 Gate，不在现场热改 JSON。
