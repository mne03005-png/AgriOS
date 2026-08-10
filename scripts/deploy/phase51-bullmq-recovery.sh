#!/usr/bin/env bash
set -euo pipefail

cd /home/ubuntu/agrios-docker-gray

compose=(docker compose --env-file .env.gray -f docker-compose.production.yml -f docker-compose.gray.yml)
producer_name="agrios-gray-phase51-bullmq-producer"
queue_key="bull:agrios-action-queue:wait"

if docker container inspect "${producer_name}" >/dev/null 2>&1; then
  echo "Refusing to overwrite existing test container: ${producer_name}" >&2
  exit 1
fi

restore_api() {
  "${compose[@]}" start agrios-api >/dev/null 2>&1 || true
}
trap restore_api EXIT

"${compose[@]}" stop agrios-api

"${compose[@]}" run --no-deps --name "${producer_name}" agrios-api \
  node -e "const { Queue } = require('bullmq'); const q = new Queue('agrios-action-queue', { connection: { host: 'agrios-redis', port: 6379, maxRetriesPerRequest: null } }); q.add('action-job', { jobId: 'phase51-recovery-nonexistent' }, { removeOnComplete: 1000, removeOnFail: 1000 }).then(() => q.close()).catch((error) => { console.error(error); process.exit(1); });"

waiting_before=$("${compose[@]}" exec -T agrios-redis redis-cli LLEN "${queue_key}" | tr -d '\r')
if [[ "${waiting_before}" -lt 1 ]]; then
  echo "Expected a waiting BullMQ job while API was stopped; got ${waiting_before}" >&2
  exit 1
fi

"${compose[@]}" start agrios-api

for attempt in $(seq 1 30); do
  waiting_after=$("${compose[@]}" exec -T agrios-redis redis-cli LLEN "${queue_key}" | tr -d '\r')
  health=$("${compose[@]}" ps --format json agrios-api | grep -c '"Health":"healthy"' || true)
  if [[ "${waiting_after}" == "0" && "${health}" -ge 1 ]]; then
    trap - EXIT
    printf 'PASS BullMQ restart recovery waiting_before=%s waiting_after=%s api=healthy\n' \
      "${waiting_before}" "${waiting_after}"
    exit 0
  fi
  sleep 2
done

echo "BullMQ recovery did not complete: waiting_after=${waiting_after:-unknown}" >&2
exit 1
