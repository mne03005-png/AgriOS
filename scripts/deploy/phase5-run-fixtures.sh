#!/usr/bin/env bash
set -Eeuo pipefail

cd "${AGRIOS_GRAY_DIR:-/home/ubuntu/agrios-docker-gray}"
set -a
# shellcheck disable=SC1091
source .phase5-test.env
set +a
compose=(docker compose --env-file .env.gray -f docker-compose.production.yml -f docker-compose.gray.yml)

# Variable expands inside the container.
# shellcheck disable=SC2016
counts="$("${compose[@]}" exec -T agrios-mysql sh -c 'mysql -N -B -uroot -p"$MYSQL_ROOT_PASSWORD" agrios -e "SELECT (SELECT COUNT(*) FROM User WHERE id LIKE \"phase5-%\"),(SELECT COUNT(*) FROM Tenant WHERE id LIKE \"phase5-%\");"' 2>/dev/null)"
[[ "$counts" == $'0\t0' ]] || { echo "refusing existing fixtures: $counts" >&2; exit 1; }

"${compose[@]}" exec -T -e PHASE5_PASSWORD agrios-api node \
  < scripts/deploy/phase5-create-fixtures-v2.mjs
