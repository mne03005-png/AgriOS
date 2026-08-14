#!/usr/bin/env bash
set -Eeuo pipefail

cd "${AGRIOS_GRAY_DIR:-/home/ubuntu/agrios-docker-gray}"
compose=(docker compose --env-file .env.gray -f docker-compose.production.yml -f docker-compose.gray.yml)
mapfile -t containers < <("${compose[@]}" ps -q)
[[ "${#containers[@]}" -eq 5 ]] || { echo "expected 5 gray containers, found ${#containers[@]}" >&2; exit 1; }

printf 'restarting=%s\n' "${containers[*]}"
docker restart "${containers[@]}" >/dev/null

for attempt in $(seq 1 60); do
  healthy=0
  for container in "${containers[@]}"; do
    [[ "$(docker inspect --format '{{.State.Health.Status}}' "$container")" == 'healthy' ]] && healthy=$((healthy + 1))
  done
  printf 'attempt=%s healthy=%s/5\n' "$attempt" "$healthy"
  [[ "$healthy" -eq 5 ]] && break
  sleep 2
done

for container in "${containers[@]}"; do
  [[ "$(docker inspect --format '{{.State.Health.Status}}' "$container")" == 'healthy' ]]
done

curl -fsS http://127.0.0.1:3200/api/v1/health/live >/dev/null
curl -fsS http://127.0.0.1:3200/api/v1/health/ready >/dev/null
curl -fsS http://127.0.0.1:3201/login | grep -qi '<div id="app"'

# Variables expand inside the containers.
# shellcheck disable=SC2016
"${compose[@]}" exec -T agrios-mysql sh -c 'mysql --default-character-set=utf8mb4 -N -B -uroot -p"$MYSQL_ROOT_PASSWORD" agrios -e "
SELECT CONCAT(\"phase5_users=\",COUNT(*)) FROM User WHERE id LIKE \"phase5-%\";
SELECT CONCAT(\"phase5_tenants=\",COUNT(*)) FROM Tenant WHERE id LIKE \"phase5-%\";
SELECT CONCAT(\"migrations=\",COUNT(*)) FROM _prisma_migrations;
"' 2>/dev/null
redis_wait="$("${compose[@]}" exec -T agrios-redis redis-cli LLEN bull:agrios-action-queue:wait | tr -d '\r')"
printf 'redis_wait=%s\n' "$redis_wait"

# Variables expand inside the container.
# shellcheck disable=SC2016
"${compose[@]}" exec -T agrios-mosquitto sh -c 'mosquitto_pub -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" -q 1 -t "$CONTROL/dynamic-security/v1" -m "{\"commands\":[{\"command\":\"getClients\"}]}" >/dev/null'

pm2 jlist 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const x=JSON.parse(d).find(x=>x.name==='agrios-backend');console.log('pm2='+x?.pm2_env?.status+' pid='+x?.pid+' restarts='+x?.pm2_env?.restart_time)})"
curl -sS -o /dev/null -w 'public_live=%{http_code}\n' https://agrios-api.xyzwtt.com/api/v1/health/live
"${compose[@]}" ps
