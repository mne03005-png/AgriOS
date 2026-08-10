#!/usr/bin/env bash
set -Eeuo pipefail

cd "${AGRIOS_GRAY_DIR:-/home/ubuntu/agrios-docker-gray}"
compose=(docker compose --env-file .env.gray -f docker-compose.production.yml -f docker-compose.gray.yml)
redis_container="$("${compose[@]}" ps -q agrios-redis)"
[[ -n "$redis_container" ]]

before_keys="$("${compose[@]}" exec -T agrios-redis redis-cli --scan --pattern 'bull:agrios-action-queue:*' | wc -l)"
before_wait="$("${compose[@]}" exec -T agrios-redis redis-cli LLEN bull:agrios-action-queue:wait | tr -d '\r')"
before_aof="$("${compose[@]}" exec -T agrios-redis redis-cli INFO persistence | awk -F: '/^aof_enabled:/ {gsub(/\r/,"",$2); print $2}')"
printf 'before_keys=%s before_wait=%s aof_enabled=%s\n' "$before_keys" "$before_wait" "$before_aof"

docker restart "$redis_container" >/dev/null
for attempt in $(seq 1 30); do
  health="$(docker inspect --format '{{.State.Health.Status}}' "$redis_container")"
  printf 'attempt=%s health=%s\n' "$attempt" "$health"
  [[ "$health" == 'healthy' ]] && break
  sleep 2
done
[[ "$(docker inspect --format '{{.State.Health.Status}}' "$redis_container")" == 'healthy' ]]

after_keys="$("${compose[@]}" exec -T agrios-redis redis-cli --scan --pattern 'bull:agrios-action-queue:*' | wc -l)"
after_wait="$("${compose[@]}" exec -T agrios-redis redis-cli LLEN bull:agrios-action-queue:wait | tr -d '\r')"
printf 'after_keys=%s after_wait=%s redis_health=healthy\n' "$after_keys" "$after_wait"

[[ "$before_keys" == "$after_keys" ]]
[[ "$before_wait" == "$after_wait" ]]

# The current adapter should consume from Redis after recovery. A non-zero
# wait list after an API recovery window demonstrates that no BullMQ Worker
# drains persisted jobs.
sleep 5
recovery_wait="$("${compose[@]}" exec -T agrios-redis redis-cli LLEN bull:agrios-action-queue:wait | tr -d '\r')"
printf 'recovery_wait_after_5s=%s\n' "$recovery_wait"
if (( recovery_wait > 0 )); then
  printf '%s\n' 'BULLMQ_RECOVERY=failed persisted jobs are not consumed by the API after Redis restart'
else
  printf '%s\n' 'BULLMQ_RECOVERY=passed'
fi
