# AgriOS P12.3 Edge Gateway Foundation

Edge / PLC 是生产环境优先控制路径，用于现场本地网络、断网续传、本地急停、PLC/控制柜执行。

当前阶段只做后端模型、接口、文档和 adapter skeleton，不开发独立 Edge 程序，不真实控制硬件，不自动开泵/开阀。

## 模型

- `EdgeGateway`：现场 Edge Controller / PLC 网关。
- `EdgeDeviceBinding`：AgriOS 设备与 Edge 本地地址绑定。
- `EdgeCommand`：待下发命令、回执、失败记录。

## 控制边界

AgriOS Mobile -> Safety -> Approval -> ActionQueue -> DeviceControl -> EDGE_HTTP / PLC_GATEWAY -> Feedback。

## 后续

P12 后续阶段可接入真实 Edge HTTP API、PLC 网关协议、离线缓存和本地急停事件回传。
