# AgriOS Phase 6 切换 Runbook

## Go/No-Go 清单

- 公网 PM2 API 健康且回滚入口 `127.0.0.1:3100` 可用。
- Docker 五个服务均 healthy；API/Web 仅监听 `127.0.0.1:3200/3201`。
- `health/live`、`health/ready`、登录、JWT refresh、租户隔离、BullMQ、MQTT 和 ACK HMAC 全部通过。
- `DEVICE_CONTROL_MODE=MOCK`、`DEVICE_CONTROL_DRY_RUN=true`、`VALVE_ALLOW_REAL_CONTROL=false`。
- Prisma migration 为 19 且 schema up to date；Docker 数据卷备份可读取。
- 宝塔当前 vhost、证书和 Nginx 主配置已备份并记录校验和。
- 操作人、观察人、回滚负责人和维护窗口已确认。

## 切换

1. 记录 PM2、Docker、数据库、Redis、MQTT 和公网 health 基线。
2. 备份当前 API vhost；现网当前为直接代理 `127.0.0.1:3100`，不能直接引用尚未定义的命名 upstream。
3. 安装完整迁移模板，但保持主路由和 `/healthz` 均指向 `agrios_api_pm2`。执行宝塔 Nginx 语法检查，通过后 reload，并验证公网行为不变。
4. 再次备份该 PM2 基线模板，然后仅将两处 `proxy_pass http://agrios_api_pm2` 改为 `proxy_pass http://agrios_api_docker`：主路由及 `/healthz`。
5. 对 Docker 候选配置执行语法检查；失败则不 reload，并恢复 PM2 基线模板。
6. reload 宝塔 Nginx，不执行 restart。
7. 立即验证公网 live、ready、Swagger、登录、refresh、权限、CORS 和 MOCK 指令。
8. 观察 Nginx/API 错误率、延迟、容器健康、BullMQ waiting/failed、MySQL 连接和 MQTT ACK 至少 15 分钟。
9. 验证稳定后才执行 `pm2 stop agrios-backend`；保留 PM2 定义、代码和环境，不 delete。

## 回滚

1. 将两处 upstream 恢复为 `agrios_api_pm2`。
2. 执行宝塔 Nginx 语法检查，通过后 reload。
3. 若 PM2 已停止，执行 `pm2 start agrios-backend` 或使用原 ecosystem 配置恢复。
4. 验证公网 live、ready、登录和关键只读业务。
5. Docker 容器与卷保持原状，供故障分析；不得清理数据。

## 立即回滚条件

- 任一公网 health 连续两次失败。
- 登录/JWT refresh、租户隔离或权限出现异常。
- 5xx 明显增加、数据库连接异常或队列持续积压。
- MQTT ACK 异常或任何真实设备控制风险信号。
- Docker 容器反复重启或关键服务 unhealthy。
