#!/usr/bin/env bash
set -Eeuo pipefail

gray_dir=${AGRIOS_GRAY_DIR:-/home/ubuntu/agrios-docker-gray}
template="$gray_dir/infra/nginx/baota/agrios-api.docker-migration.conf.template"
test_dir=$(mktemp -d /tmp/agrios-phase55.XXXXXX)
pm2_container=agrios-phase55-nginx-pm2
docker_container=agrios-phase55-nginx-docker

for name in "$pm2_container" "$docker_container"; do
  if docker container inspect "$name" >/dev/null 2>&1; then
    echo "Refusing to overwrite existing rehearsal container: $name" >&2
    exit 1
  fi
done

prepare_config() {
  local upstream=$1 output=$2
  sed \
    -e '1i map $http_upgrade $connection_upgrade { default upgrade; "" close; }' \
    -e 's/listen 80;/listen 32080;/' \
    -e 's/listen 443 ssl;/listen 32443 ssl;/' \
    -e "s#proxy_pass http://agrios_api_pm2#proxy_pass http://${upstream}#g" \
    "$template" >"$output"
}

run_case() {
  local name=$1 config=$2 expected=$3
  docker run -d --name "$name" --network host \
    -v "$config:/etc/nginx/conf.d/default.conf:ro" \
    -v /etc/letsencrypt:/etc/letsencrypt:ro \
    -v /www/wwwlogs:/www/wwwlogs \
    agrios-web:d382ce9-gray1 >/dev/null
  docker exec "$name" nginx -t
  for attempt in $(seq 1 10); do
    if body=$(curl -kfsS --resolve agrios-api.xyzwtt.com:32443:127.0.0.1 \
      https://agrios-api.xyzwtt.com:32443/healthz); then
      grep -q '"ok":true' <<<"$body"
      echo "PASS simulated upstream=${expected} healthz=ready"
      docker stop "$name" >/dev/null
      return 0
    fi
    sleep 1
  done
  docker stop "$name" >/dev/null || true
  return 1
}

prepare_config agrios_api_pm2 "$test_dir/pm2.conf"
prepare_config agrios_api_docker "$test_dir/docker.conf"
run_case "$pm2_container" "$test_dir/pm2.conf" PM2
run_case "$docker_container" "$test_dir/docker.conf" Docker

echo "INFO rehearsal files retained at $test_dir"
echo 'INFO stopped rehearsal containers retained; no production Nginx change or reload performed'
