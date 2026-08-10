# AgriOS Phase 6 Final Cutover Checklist

> 本文件是人工执行清单。Phase 6 获得明确批准前，不执行任何写入、reload、PM2 stop 或数据库命令。

## 1. 人员与窗口

- [ ] 切换操作人、观察人、回滚负责人在线。
- [ ] 维护窗口开始时间、最长观察时间和回滚截止时间已记录。
- [ ] 明确口令：只有负责人说“批准 Phase 6 切换”才允许继续。

## 2. Go/No-Go 基线

- [ ] `pm2 describe agrios-backend` 显示 online，`127.0.0.1:3100/api/v1/health/live` 返回 200。
- [ ] 记录既有 PM2 当前监听为 `*:3100`；UFW 未开放 3100，回滚只通过本机 Nginx upstream，不直接暴露该端口。
- [ ] 灰度 Compose 五个服务均 healthy。
- [ ] Docker live/ready、登录、refresh、租户隔离、权限、BullMQ、MQTT、ACK HMAC 已通过。
- [ ] Docker API/Web 仅绑定 `127.0.0.1:3200/3201`。
- [ ] 安全开关为 `MOCK`、`DRY_RUN=true`、`VALVE_ALLOW_REAL_CONTROL=false`。
- [ ] 宝塔 Nginx 当前语法检查通过，证书可读且有效。
- [ ] 公网 live/ready 返回 200；切换前错误率没有异常。

任一项失败：**No-Go，不切换。**

## 3. 最终备份（批准后、切换前执行）

```bash
cutover_id=$(date +%Y%m%d-%H%M%S)
cutover_backup=/home/ubuntu/backups/agrios/cutover/$cutover_id
sudo install -d -m 700 -o ubuntu -g ubuntu "$cutover_backup"

sudo install -m 600 /www/server/panel/vhost/nginx/agrios-api.xyzwtt.com.conf \
  "$cutover_backup/agrios-api.vhost.pre-phase6.conf"
sudo install -m 600 /www/server/nginx/conf/nginx.conf \
  "$cutover_backup/baota-nginx.pre-phase6.conf"
sudo sha256sum /www/server/panel/vhost/nginx/agrios-api.xyzwtt.com.conf \
  /www/server/nginx/conf/nginx.conf | tee "$cutover_backup/nginx.sha256"

pm2 save
install -m 600 /home/ubuntu/.pm2/dump.pm2 "$cutover_backup/pm2-dump.pre-phase6.json"
pm2 describe agrios-backend >"$cutover_backup/pm2-describe.txt"

cd /home/ubuntu/agrios-server
AGRIOS_BACKUP_DIR="$cutover_backup/database" bash scripts/ops/backup-mysql.sh
latest_db=$(find "$cutover_backup/database" -maxdepth 1 -name 'agrios-*.sql.gz' -type f | sort | tail -1)
bash scripts/ops/verify-backup.sh "$latest_db"

cd /home/ubuntu/agrios-docker-gray
docker compose --env-file .env.gray -f docker-compose.production.yml -f docker-compose.gray.yml ps \
  >"$cutover_backup/docker-compose-ps.txt"
docker image inspect agrios-api:d382ce9-phase51 agrios-web:d382ce9-gray1 \
  >"$cutover_backup/docker-images.json"
```

- [ ] vhost、Nginx 主配置、PM2 dump、数据库备份和镜像元数据均存在且非空。
- [ ] 数据库备份校验输出 `VERIFY_BACKUP=ok`。
- [ ] 备份目录权限为 700，敏感文件权限为 600。
- [ ] 将 `cutover_backup` 的实际路径记录到操作日志。

## 4. 宝塔 Nginx 候选配置检查

- [ ] 候选配置完整定义 `agrios_api_pm2=127.0.0.1:3100`。
- [ ] 候选配置完整定义 `agrios_api_docker=127.0.0.1:3200`。
- [ ] PM2 基线阶段，主路由和 `/healthz` 两处都指向 `agrios_api_pm2`。
- [ ] Docker 切换阶段，两处必须同时改为 `agrios_api_docker`。
- [ ] 证书路径、ACME location、日志路径和 WebSocket headers 与现网兼容。
- [ ] 每次安装候选配置后，先执行以下命令；失败时禁止 reload：

```bash
sudo /www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf
```

正式批准后唯一允许的 reload 命令：

```bash
sudo /www/server/nginx/sbin/nginx -s reload -c /www/server/nginx/conf/nginx.conf
```

禁止使用 `systemctl reload nginx`，因为服务器同时存在系统 Nginx 与宝塔 Nginx。

## 5. 切换后验证

- [ ] 公网 `/healthz`、`health/live`、`health/ready` 连续通过。
- [ ] Swagger、登录、JWT refresh、权限和 Tenant 隔离通过。
- [ ] CORS 仅允许生产 Web origin。
- [ ] MOCK 指令与 ACK HMAC 通过，未产生真实控制。
- [ ] BullMQ 无持续 waiting/failed 积压，MQTT ACK 正常。
- [ ] 观察 Nginx 5xx、Docker 日志、MySQL 连接和容器健康至少 15 分钟。
- [ ] 上述全部稳定后，才允许 `pm2 stop agrios-backend`；禁止 `pm2 delete`。

## 6. 回滚命令

如果 PM2 已停止，先恢复 PM2 并验证本机入口：

```bash
pm2 restart agrios-backend
curl -fsS http://127.0.0.1:3100/api/v1/health/live
```

如果 PM2 条目不存在：

```bash
cd /home/ubuntu/agrios-server
pm2 start ecosystem.config.cjs --only agrios-backend
curl -fsS http://127.0.0.1:3100/api/v1/health/live
```

恢复 Nginx 配置并检查；只有检查通过才 reload：

```bash
sudo install -m 600 "$cutover_backup/agrios-api.vhost.pre-phase6.conf" \
  /www/server/panel/vhost/nginx/agrios-api.xyzwtt.com.conf
sudo /www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf
sudo /www/server/nginx/sbin/nginx -s reload -c /www/server/nginx/conf/nginx.conf
curl -fsS https://agrios-api.xyzwtt.com/api/v1/health/live
```

Docker 不需要停止或删除；保持容器与卷供分析。若只是 Docker 进程异常，可在公网已回滚 PM2 后执行：

```bash
cd /home/ubuntu/agrios-docker-gray
docker compose --env-file .env.gray -f docker-compose.production.yml -f docker-compose.gray.yml restart agrios-api
```

不要在故障窗口执行 `docker compose down -v`、删除镜像、删除卷或数据库回滚。

## 7. 完成条件

- [ ] 观察窗口结束且所有指标稳定。
- [ ] PM2 仅 stop、未 delete，恢复命令再次确认。
- [ ] 备份路径、切换时间、验证结果和负责人签字已归档。
- [ ] 如果任一验收项失败，已执行回滚并确认公网恢复。
