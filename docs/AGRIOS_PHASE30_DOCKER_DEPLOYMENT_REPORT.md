# AgriOS Phase30 Docker 生产部署报告

> 目标服务器：腾讯云 Ubuntu
> 部署目录：`/home/ubuntu/agrios-server`
> 域名：`agrios.xyzwtt.com`、`agrios-api.xyzwtt.com`、`agrios-mqtt.xyzwtt.com`

## 1. 结论

已建立与现有 AEOS 运行方式一致、但资源完全隔离的 AgriOS Docker Compose 生产栈。生产栈只包含：

- `agrios-api`
- `agrios-web`
- `agrios-mysql`（MySQL 8.4）
- `agrios-redis`（Redis 7）
- `agrios-mosquitto`（Mosquitto 2 / MQTT TLS 8883）

不使用 `docker-compose.p12.yml`，不使用 PM2，不修改业务逻辑，不新增 migration。API 启动时仅执行仓库已有的 `prisma migrate deploy`，用于应用已经提交的迁移。

## 2. 隔离设计

| 资源 | AgriOS | 隔离保证 |
|---|---|---|
| Compose project | `agrios-production` | 命令始终显式指定 `-p agrios-production` |
| Docker network | `agrios-production-internal` | 不加入 AEOS/麻将网络 |
| MySQL volume | `agrios-production-mysql-data` | 不复用现有数据库卷 |
| Redis volume | `agrios-production-redis-data` | 不复用现有 Redis |
| Mosquitto volume | `agrios-production-mosquitto-data` | 不复用 AEOS MQTT 数据 |
| API host port | `127.0.0.1:3200` | 仅宿主 Nginx 可访问 |
| Web host port | `127.0.0.1:3201` | 仅宿主 Nginx 可访问 |
| MQTT | `0.0.0.0:8883` TLS | 腾讯云安全组只开放 8883；无明文 1883 |

AgriOS 容器不连接 AEOS/麻将数据库、Redis、Docker 网络或内部服务；`SPEECH_SERVICE_URL` 保持容器本地不可用地址，因为本次 AgriOS 五服务部署不包含语音服务。

禁止运行无 `-f docker-compose.production.yml -p agrios-production` 的 `docker compose down`。任何情况下都不得使用 `down -v`，以免删除生产数据。本文件位于 AgriOS 仓库根目录，必须使用项目名 `agrios-production`，不得操作服务器上的 AEOS Compose 项目。

## 3. 新增文件

| 文件 | 用途 |
|---|---|
| `docker-compose.production.yml` | 五服务生产栈、健康检查、独立卷/网络；通过独立项目名、网络、端口和卷与 AEOS 隔离 |
| `.env.production` | 安全占位生产变量；真实服务器值权限 0600 |
| `infra/nginx/agrios.conf` | 三域名 HTTPS/反向代理配置 |
| `infra/mosquitto/mosquitto.production.conf` | TLS 8883、动态账号认证与 ACL |
| `docs/AGRIOS_PHASE30_DOCKER_DEPLOYMENT_REPORT.md` | 部署、验证、回滚和隔离说明 |

`.dockerignore` 排除 `.env*` 与 `secrets/`，因此服务器真实环境变量和证书/动态安全数据库不会进入 Docker build context；`.gitignore` 同时排除运行时 secrets 目录。

## 4. 腾讯云上线步骤

### 4.1 上线前只读检查

```bash
cd /home/ubuntu/agrios-server
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
docker network ls
docker volume ls
sudo ss -lntp | grep -E ':(80|443|8883|3200|3201)\b' || true
```

记录 AEOS 与麻将系统容器名、网络、卷和健康状态。若 3200、3201 或 8883 已被占用，修改 AgriOS 环境变量，不能停止占用者。

### 4.2 生产环境变量

```bash
cd /home/ubuntu/agrios-server
chmod 600 .env.production
openssl rand -hex 32   # 分别生成 MySQL/JWT/MQTT 密码，不复用
editor .env.production
grep -n 'CHANGE_ME' .env.production && echo 'STOP: secrets not replaced' && exit 1 || true
```

约束：

- `POSTGRES_PASSWORD` 与 `DATABASE_URL` 中密码必须一致；特殊字符须 URL encode。
- `JWT_SECRET` 至少 48 个随机字符。
- `CORS=https://agrios.xyzwtt.com`，不允许 `*`。
- `MQTT_URL=mqtts://agrios-mqtt.xyzwtt.com:8883`。
- `.env.production` 不发送到聊天/工单，不进入镜像，服务器备份必须加密。

### 4.3 TLS 证书

先用现有宿主 Nginx/Certbot 为三个域名签发证书。Mosquitto 不能直接挂载 `/etc/letsencrypt/live`：其中通常是跨目录符号链接，且私钥权限不适合容器用户。复制证书实体到专属目录：

```bash
cd /home/ubuntu/agrios-server
sudo install -d -m 0750 -o 1883 -g 1883 secrets/mosquitto/tls
sudo install -m 0640 -o 1883 -g 1883 \
  /etc/letsencrypt/live/agrios-mqtt.xyzwtt.com/fullchain.pem \
  secrets/mosquitto/tls/fullchain.pem
sudo install -m 0640 -o 1883 -g 1883 \
  /etc/letsencrypt/live/agrios-mqtt.xyzwtt.com/privkey.pem \
  secrets/mosquitto/tls/privkey.pem
```

Certbot deploy hook 重复上述两个 `install` 命令，然后仅重启 AgriOS Mosquitto：

```bash
docker compose --env-file .env.production -f docker-compose.production.yml \
  -p agrios-production restart agrios-mosquitto
```

### 4.4 初始化 Mosquitto 动态安全数据库

仅首次执行：

```bash
cd /home/ubuntu/agrios-server
sudo install -d -m 0750 -o 1883 -g 1883 secrets/mosquitto
docker run --rm --env-file .env.production \
  -v "$PWD/secrets/mosquitto:/out" eclipse-mosquitto:2.0.22 \
  sh -lc 'test ! -e /out/dynamic-security.json && mosquitto_ctrl dynsec init /out/dynamic-security.json "$MQTT_USERNAME" "$MQTT_PASSWORD"'
sudo chown 1883:1883 secrets/mosquitto/dynamic-security.json
sudo chmod 0600 secrets/mosquitto/dynamic-security.json
```

必须挂载整个 `secrets/mosquitto` 目录，不能单独 bind mount JSON 文件；动态安全插件通过原子重命名保存 ACL，单文件挂载会报 `Resource busy`。

先启动基础设施：

```bash
docker compose --env-file .env.production -f docker-compose.production.yml \
  -p agrios-production up -d agrios-mysql agrios-redis agrios-mosquitto
```

为 API 管理账号增加最小业务 ACL。下列命令中的密码从容器环境读取，不出现在 shell history：

```bash
CTRL='mosquitto_ctrl -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" dynsec'
docker compose --env-file .env.production -f docker-compose.production.yml -p agrios-production exec agrios-mosquitto sh -lc "$CTRL addRoleACL admin subscribePattern 'agrios/+/+/telemetry' allow 0"
docker compose --env-file .env.production -f docker-compose.production.yml -p agrios-production exec agrios-mosquitto sh -lc "$CTRL addRoleACL admin subscribePattern 'agrios/+/+/ack' allow 0"
docker compose --env-file .env.production -f docker-compose.production.yml -p agrios-production exec agrios-mosquitto sh -lc "$CTRL addRoleACL admin publishClientReceive 'agrios/+/+/telemetry' allow 0"
docker compose --env-file .env.production -f docker-compose.production.yml -p agrios-production exec agrios-mosquitto sh -lc "$CTRL addRoleACL admin publishClientReceive 'agrios/+/+/ack' allow 0"
docker compose --env-file .env.production -f docker-compose.production.yml -p agrios-production exec agrios-mosquitto sh -lc "$CTRL addRoleACL admin publishClientSend 'agrios/+/+/commands' allow 0"
unset CTRL
```

以上是 API 的聚合权限。设备账号仍由现有 Device Registry 动态创建，只能 publish 自身 telemetry/ack 和 subscribe/receive 自身 commands。

### 4.5 Compose 验证、构建和启动

```bash
docker compose --env-file .env.production -f docker-compose.production.yml \
  -p agrios-production config --quiet
docker compose --env-file .env.production -f docker-compose.production.yml \
  -p agrios-production build agrios-api agrios-web
docker compose --env-file .env.production -f docker-compose.production.yml \
  -p agrios-production up -d --wait --wait-timeout 180
docker compose --env-file .env.production -f docker-compose.production.yml \
  -p agrios-production ps
```

不得运行 PM2，不得启动 `docker-compose.p12.yml`。

### 4.6 Nginx

```bash
sudo install -m 0644 infra/nginx/agrios.conf /etc/nginx/sites-available/agrios.conf
sudo ln -sfn /etc/nginx/sites-available/agrios.conf /etc/nginx/sites-enabled/agrios.conf
sudo nginx -t
sudo systemctl reload nginx
```

只有 `nginx -t` 成功才允许 reload。配置只增加三个 `server_name`，上游为 localhost 3200/3201，不更改 AEOS 或麻将站点文件。MQTT TLS 由 Mosquitto 直接在 8883 终止，Nginx 不代理 MQTT。

## 5. 健康检查

```bash
curl -fsS http://127.0.0.1:3200/api/v1/health
curl -fsSI http://127.0.0.1:3201/agrios
curl -fsS https://agrios-api.xyzwtt.com/healthz
curl -fsSI https://agrios.xyzwtt.com/agrios

docker compose --env-file .env.production -f docker-compose.production.yml \
  -p agrios-production exec agrios-mosquitto sh -lc \
  'mosquitto_pub -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" -q 1 -t "\$CONTROL/dynamic-security/v1" -m "{\"commands\":[{\"command\":\"getClients\"}]}"'
```

另从场外网络验证 8883 可达、1883 不可达，并确认错误密码/错误 CA 被拒绝。

## 6. 本地验证结果

| 验证 | 结果 |
|---|---|
| `docker compose config --quiet` | 通过；仅五个指定服务 |
| API image build | 通过 |
| Web image build | 通过；19 个页面生成成功 |
| MySQL 8.4 health | healthy |
| Redis 7 health | healthy |
| Mosquitto 8883 TLS/account health | healthy |
| API health + 既有 migration deploy | healthy |
| Web `/agrios` health | healthy / HTTP 200 |
| 五服务 `up --wait` | 通过 |
| Nginx `nginx -t` | 通过 |
| Dynamic Security ACL 原子写入 | 通过；改为目录挂载后无 `Resource busy` |

验证使用隔离端口 3290/3291/8893 和临时自签证书，不接触现有 AEOS/麻将容器、网络或卷。

## 7. 回滚与备份

部署前备份 AgriOS MySQL 和 Mosquitto dynamic-security.json。应用回滚只修改 `AGRIOS_IMAGE_TAG` 为上一版本并执行：

```bash
docker compose --env-file .env.production -f docker-compose.production.yml \
  -p agrios-production up -d --no-deps agrios-api agrios-web
```

若首次上线失败，仅停止 AgriOS：

```bash
docker compose --env-file .env.production -f docker-compose.production.yml \
  -p agrios-production stop
```

不要删除卷，不要修改或重启 AEOS/麻将 Compose project。数据库 migration 只允许向前兼容；本次没有新增 migration。
