#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${AGRIOS_ENV_FILE:-$REPO_ROOT/apps/backend/.env}"
BACKUP_FILE="${1:-}"
TMP_CNF=""
TMP_META=""
TEST_DB=""
CREATED_DB=false
KEY_TABLES=(User Tenant Farm TenantFarm Field Device _prisma_migrations)

cleanup() {
  local status=$?
  if [[ "$CREATED_DB" == true && "$TEST_DB" =~ ^agrios_restore_test_[A-Za-z0-9_]+$ ]]; then
    mysql --defaults-extra-file="$TMP_CNF" -e "DROP DATABASE \`$TEST_DB\`" >/dev/null 2>&1 || true
  fi
  [[ -n "$TMP_CNF" && -f "$TMP_CNF" ]] && rm -f "$TMP_CNF"
  [[ -n "$TMP_META" && -f "$TMP_META" ]] && rm -f "$TMP_META"
  exit "$status"
}
trap cleanup EXIT

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

[[ -n "$BACKUP_FILE" ]] || fail "usage: restore-backup-test.sh <backup.sql.gz>"
"$SCRIPT_DIR/verify-backup.sh" "$BACKUP_FILE" >/dev/null
command -v node >/dev/null 2>&1 || fail "node is required"
command -v mysql >/dev/null 2>&1 || fail "mysql is required"
command -v gzip >/dev/null 2>&1 || fail "gzip is required"

TMP_CNF="$(mktemp /tmp/agrios-restore-client-XXXXXX.cnf)"
TMP_META="$(mktemp /tmp/agrios-restore-meta-XXXXXX)"
chmod 600 "$TMP_CNF" "$TMP_META"

node - "$ENV_FILE" "$TMP_CNF" "$TMP_META" <<'NODE'
const fs = require('fs');
const [envFile, cnfFile, metaFile] = process.argv.slice(2);
const text = fs.readFileSync(envFile, 'utf8');
const line = text.split(/\r?\n/).find((item) => item.trim().startsWith('DATABASE_URL='));
if (!line) throw new Error('DATABASE_URL is missing');
let raw = line.slice(line.indexOf('=') + 1).trim();
if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) raw = raw.slice(1, -1);
const url = new URL(raw);
const database = url.pathname.replace(/^\//, '');
fs.writeFileSync(cnfFile, [
  '[client]',
  `host=${url.hostname}`,
  `port=${url.port || '3306'}`,
  `user=${decodeURIComponent(url.username)}`,
  `password=${decodeURIComponent(url.password)}`,
  'default-character-set=utf8mb4',
  ''
].join('\n'), { mode: 0o600 });
fs.writeFileSync(metaFile, `PROD_DB=${JSON.stringify(database)}\n`, { mode: 0o600 });
NODE

# shellcheck disable=SC1090
source "$TMP_META"

TEST_DB="agrios_restore_test_$(date +%Y%m%d_%H%M%S)_$RANDOM"
[[ "$TEST_DB" =~ ^agrios_restore_test_[A-Za-z0-9_]+$ ]] || fail "unsafe restore database name"
[[ "$TEST_DB" != "$PROD_DB" ]] || fail "restore database name must not match production database"

mysql --defaults-extra-file="$TMP_CNF" -e "CREATE DATABASE \`$TEST_DB\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
CREATED_DB=true
gzip -cd "$BACKUP_FILE" | mysql --defaults-extra-file="$TMP_CNF" "$TEST_DB"

for table in "${KEY_TABLES[@]}"; do
  exists="$(mysql --defaults-extra-file="$TMP_CNF" -N -B -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$TEST_DB' AND table_name='$table'")"
  [[ "$exists" == "1" ]] || fail "restored database missing key table: $table"
  count="$(mysql --defaults-extra-file="$TMP_CNF" -N -B -e "SELECT COUNT(*) FROM \`$TEST_DB\`.\`$table\`")"
  echo "RESTORE_TABLE_${table}_ROWS=$count"
done

echo "RESTORE_TEST_DB=$TEST_DB"
echo "RESTORE_TEST=ok"
