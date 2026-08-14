#!/usr/bin/env bash
set -Eeuo pipefail

TARGET_DIR="${AGRIOS_GRAY_DIR:-/home/ubuntu/agrios-docker-gray}"
BACKUP_DIR="${AGRIOS_BACKUP_DIR:-/home/ubuntu/backups/agrios/daily}"

cd "$TARGET_DIR"
compose=(docker compose --env-file .env.gray -f docker-compose.production.yml -f docker-compose.gray.yml)

backup="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'agrios-*.sql.gz' -printf '%T@ %p\n' | sort -rn | awk 'NR==1 {$1=""; sub(/^ /,""); print}')"
[[ -n "$backup" ]] || { echo "no backup found in $BACKUP_DIR" >&2; exit 1; }
bash scripts/ops/verify-backup.sh "$backup" >/dev/null

# Variable expands inside the container.
# shellcheck disable=SC2016
before_tables="$("${compose[@]}" exec -T agrios-mysql sh -c 'mysql --default-character-set=utf8mb4 -N -B -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=\"agrios\""' 2>/dev/null)"
[[ "$before_tables" == '0' ]] || { echo "refusing non-empty gray database: tables=$before_tables" >&2; exit 1; }

if zgrep -E -m1 '^(DROP DATABASE|TRUNCATE TABLE|DELETE FROM)' "$backup" >/dev/null; then
  echo 'refusing backup containing destructive database statements' >&2
  exit 1
fi

drop_count="$(zgrep -c '^DROP TABLE IF EXISTS' "$backup" || true)"
printf 'backup=%s\n' "$backup"
printf 'backup_sha256=%s\n' "$(sha256sum "$backup" | awk '{print $1}')"
printf 'target_tables_before=%s\n' "$before_tables"
printf 'drop_statements_filtered=%s\n' "$drop_count"

# --default-character-set=utf8mb4 is required here: without it the mysql client falls back to
# its own default (latin1, NOT the server/database's utf8mb4), silently substituting '?' for
# every multi-byte Chinese character in the dump on the way in even though the dump file itself
# is valid UTF-8 (this is exactly how the demo farm/user Chinese names were corrupted in
# production -- see PROD-USABILITY-1's root-cause report). The dump is already produced with
# --default-character-set=utf8mb4 by scripts/ops/backup-mysql.sh; the restore side must match.
#
# Variable expands inside the container.
# shellcheck disable=SC2016
gzip -cd "$backup" \
  | awk '!/^DROP TABLE IF EXISTS/' \
  | "${compose[@]}" exec -T agrios-mysql sh -c 'mysql --default-character-set=utf8mb4 -uroot -p"$MYSQL_ROOT_PASSWORD" agrios' 2>/dev/null

# Variable expands inside the container.
# shellcheck disable=SC2016
"${compose[@]}" exec -T agrios-mysql sh -c 'mysql --default-character-set=utf8mb4 -N -B -uroot -p"$MYSQL_ROOT_PASSWORD" agrios -e "
SELECT CONCAT(\"tables=\",COUNT(*),\" size_mb=\",ROUND(SUM(data_length+index_length)/1024/1024,2),\" estimated_rows=\",SUM(table_rows)) FROM information_schema.tables WHERE table_schema=DATABASE();
SELECT CONCAT(\"User=\",COUNT(*)) FROM User;
SELECT CONCAT(\"AuditEvent=\",COUNT(*)) FROM AuditEvent;
SELECT CONCAT(\"Tenant=\",COUNT(*)) FROM Tenant;
SELECT CONCAT(\"Farm=\",COUNT(*)) FROM Farm;
SELECT CONCAT(\"migrations=\",COUNT(*)) FROM _prisma_migrations;
"' 2>/dev/null
