#!/usr/bin/env bash
set -Eeuo pipefail

cd "${AGRIOS_GRAY_DIR:-/home/ubuntu/agrios-docker-gray}"
set -a
# shellcheck disable=SC1091
source .phase5-test.env
set +a
compose=(docker compose --env-file .env.gray -f docker-compose.production.yml -f docker-compose.gray.yml)
"${compose[@]}" exec -T -e PHASE5_PASSWORD agrios-api node \
  < scripts/deploy/phase51-api-tests.mjs
