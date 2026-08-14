#!/usr/bin/env bash
set -Eeuo pipefail

cd "${AGRIOS_GRAY_DIR:-/home/ubuntu/agrios-docker-gray}"
compose=(docker compose --env-file .env.gray -f docker-compose.production.yml -f docker-compose.gray.yml)

printf '%s\n' '===== DATA COUNTS ====='
# Variable expands inside the container.
# shellcheck disable=SC2016
"${compose[@]}" exec -T agrios-mysql sh -c 'mysql --default-character-set=utf8mb4 -N -B -uroot -p"$MYSQL_ROOT_PASSWORD" agrios -e "
SELECT CONCAT(\"User.total=\",COUNT(*),\" phase5=\",SUM(id LIKE \"phase5-%\")) FROM User;
SELECT CONCAT(\"Tenant.total=\",COUNT(*),\" phase5=\",SUM(id LIKE \"phase5-%\")) FROM Tenant;
SELECT CONCAT(\"Farm.total=\",COUNT(*),\" phase5=\",SUM(id LIKE \"phase5-%\")) FROM Farm;
SELECT CONCAT(\"AuditEvent.total=\",COUNT(*)) FROM AuditEvent;
SELECT CONCAT(\"Prisma.migrations=\",COUNT(*)) FROM _prisma_migrations;
SELECT eventType,COUNT(*) FROM AuditEvent WHERE eventType IN (\"cross_tenant_denied\",\"permission_denied\",\"auth.login\") GROUP BY eventType ORDER BY eventType;
SELECT status,COUNT(*) FROM DeviceCommand WHERE deviceId=\"phase5-valve-a\" GROUP BY status ORDER BY status;
SELECT status,COUNT(*) FROM ActionQueueJob WHERE farmId=\"phase5-farm-a\" GROUP BY status ORDER BY status;
SELECT JSON_UNQUOTE(JSON_EXTRACT(currentStatus,\"$.dryRun\")),JSON_UNQUOTE(JSON_EXTRACT(currentStatus,\"$.lastCommandStatus\")) FROM Device WHERE id=\"phase5-valve-a\";
"' 2>/dev/null

printf '%s\n' '===== PRISMA STATUS ====='
"${compose[@]}" exec -T agrios-api ../../node_modules/.bin/prisma migrate status \
  --schema prisma/schema.prisma

printf '%s\n' '===== POST-RESTART HEALTH ====='
curl -sS -o /dev/null -w 'live=%{http_code}\n' http://127.0.0.1:3200/api/v1/health/live
curl -sS -o /dev/null -w 'ready=%{http_code}\n' http://127.0.0.1:3200/api/v1/health/ready
curl -sS -o /dev/null -w 'swagger=%{http_code}\n' http://127.0.0.1:3200/api/docs
curl -sS -o /dev/null -w 'web_login=%{http_code}\n' http://127.0.0.1:3201/login

printf '%s\n' '===== FINAL COMPOSE PS ====='
"${compose[@]}" ps
