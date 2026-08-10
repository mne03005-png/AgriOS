#!/usr/bin/env bash
set -Eeuo pipefail

TARGET_DIR="${AGRIOS_GRAY_DIR:-/home/ubuntu/agrios-docker-gray}"
cd "$TARGET_DIR"
compose=(docker compose --env-file .env.gray -f docker-compose.production.yml -f docker-compose.gray.yml)

printf '%s\n' '===== DOCKER PS ====='
docker ps --filter label=com.docker.compose.project=agrios-gray \
  --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

printf '%s\n' '===== DOCKER COMPOSE PS ====='
"${compose[@]}" ps

printf '%s\n' '===== LISTEN BINDINGS ====='
ss -H -lntp | grep -E ':(3200|3201|38883)[[:space:]]'

printf '%s\n' '===== API LIVE ====='
curl -sS --max-time 10 http://127.0.0.1:3200/api/v1/health/live
printf '\n%s\n' '===== API READY ====='
curl -sS --max-time 10 http://127.0.0.1:3200/api/v1/health/ready

printf '\n%s\n' '===== CORS ====='
curl -sS -o /dev/null -D - --max-time 10 \
  -H 'Origin: https://agrios.xyzwtt.com' \
  http://127.0.0.1:3200/api/v1/health/live \
  | grep -iE 'HTTP/|access-control-allow-origin|vary:'

printf '%s\n' '===== WEB ====='
curl -sS -o /dev/null -w 'web_http=%{http_code} size=%{size_download}\n' \
  --max-time 10 http://127.0.0.1:3201/

printf '%s\n' '===== REDIS ====='
"${compose[@]}" exec -T agrios-redis redis-cli ping
"${compose[@]}" exec -T agrios-redis redis-cli info persistence \
  | grep -E '^(aof_enabled|aof_last_bgrewrite_status|rdb_last_bgsave_status):'

printf '%s\n' '===== MQTT TLS/AUTH ====='
# Variables expand inside the container.
# shellcheck disable=SC2016
"${compose[@]}" exec -T agrios-mosquitto sh -c \
  'mosquitto_pub -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" -q 1 -t "$CONTROL/dynamic-security/v1" -m "{\"commands\":[{\"command\":\"getClients\"}]}" >/dev/null && echo mqtt_tls_auth=ok'

printf '%s\n' '===== DATABASE ====='
# Variable expands inside the container.
# shellcheck disable=SC2016
"${compose[@]}" exec -T agrios-mysql sh -c 'mysql -N -B -uroot -p"$MYSQL_ROOT_PASSWORD" agrios -e "
SELECT CONCAT(\"tables=\",COUNT(*),\" size_mb=\",ROUND(SUM(data_length+index_length)/1024/1024,2)) FROM information_schema.tables WHERE table_schema=DATABASE();
SELECT CONCAT(\"User=\",COUNT(*)) FROM User;
SELECT CONCAT(\"AuditEvent=\",COUNT(*)) FROM AuditEvent;
SELECT CONCAT(\"Tenant=\",COUNT(*)) FROM Tenant;
SELECT CONCAT(\"Farm=\",COUNT(*)) FROM Farm;
SELECT CONCAT(\"migrations=\",COUNT(*)) FROM _prisma_migrations;
"' 2>/dev/null

printf '%s\n' '===== API START LOG ====='
"${compose[@]}" logs --no-color agrios-api \
  | grep -E 'migration|Migration|Nest application successfully started|error|ERROR' \
  | tail -20 || true

printf '%s\n' '===== PRODUCTION UNCHANGED ====='
pm2 jlist 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const x=JSON.parse(d).find(x=>x.name==='agrios-backend');console.log(JSON.stringify({status:x?.pm2_env?.status,pid:x?.pid,restarts:x?.pm2_env?.restart_time,script:x?.pm2_env?.pm_exec_path}))})"
curl -sS -o /dev/null -w 'public_live=%{http_code}\n' --max-time 10 \
  https://agrios-api.xyzwtt.com/api/v1/health/live

printf '%s\n' '===== VOLUMES/NETWORK ====='
docker volume ls --format '{{.Name}}' | grep '^agrios-gray-'
docker network inspect agrios-gray-internal \
  --format 'network={{.Name}} driver={{.Driver}} containers={{len .Containers}}'
