#!/usr/bin/env bash
set -Eeuo pipefail

cd "${AGRIOS_GRAY_DIR:-/home/ubuntu/agrios-docker-gray}"
for key in JWT_REFRESH_SECRET DEVICE_ACK_HMAC_SECRET; do
  if grep -q "^${key}=" .env.gray; then
    echo "refusing existing environment key: $key" >&2
    exit 1
  fi
done

umask 077
printf 'JWT_REFRESH_SECRET=%s\n' "$(openssl rand -hex 48)" >>.env.gray
printf 'JWT_REFRESH_EXPIRES_IN=7d\n' >>.env.gray
printf 'DEVICE_ACK_HMAC_SECRET=%s\n' "$(openssl rand -hex 48)" >>.env.gray
printf 'DEVICE_ACK_HMAC_TOLERANCE_SECONDS=300\n' >>.env.gray
chmod 600 .env.gray

AGRIOS_IMAGE_TAG=d382ce9-phase51 docker compose \
  --env-file .env.gray \
  -f docker-compose.production.yml \
  -f docker-compose.gray.yml \
  config --quiet
printf '%s\n' 'PHASE51_GRAY_ENV=prepared'
