# AgriOS P12.5 Bluetooth Installer / Maintenance Mode

蓝牙用于近场调试、安装维护和断网应急诊断，不作为大规模日常控制主通道。

## 用途

- 首次配网
- 设备绑定
- 读取 SN
- 设置 farmId / fieldId / deviceCode
- 读取电池、信号、固件版本
- 现场测试
- 维护诊断
- 断网应急

## 禁止

- 普通用户绕过审批直接开泵。
- 绕过 Safety。
- 替代 Edge/PLC 主控制。
- 作为日常大规模控制路径。

## 权限

仅 `INSTALLER / MAINTAINER / TENANT_ADMIN / PLATFORM_ADMIN` 可使用维护 session。所有操作写审计。

## 当前实现

P12.5 只提供 `BluetoothSession` 和 `BluetoothOperationLog` skeleton，不接真实 BLE 协议。
