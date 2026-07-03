#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${AGRIOS_ENV_FILE:-$REPO_ROOT/apps/backend/.env}"
BACKUP_DIR="${AGRIOS_BACKUP_DIR:-/home/ubuntu/backups/agrios/daily}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/agrios-$TIMESTAMP.sql.gz"
SHA_FILE="$OUT_FILE.sha256"
TMP_CNF=""
TMP_META=""
TMP_OUT="$OUT_FILE.tmp"

KEY_TABLES=(User Tenant Farm TenantFarm Field Device _prisma_migrations)

cleanup() {
  local status=$?
  [[ -n "$TMP_CNF" && -f "$TMP_CNF" ]] && rm -f "$TMP_CNF"
  [[ -n "$TMP_META" && -f "$TMP_META" ]] && rm -f "$TMP_META"
  if [[ $status -ne 0 ]]; then
    rm -f "$TMP_OUT" "$OUT_FILE" "$SHA_FILE"
  fi
}
trap cleanup EXIT

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

require_command node
require_command mysql
require_command mysqldump
require_command gzip
require_command sha256sum
require_command mktemp

gzip_contains() {
  local file="$1"
  local pattern="$2"
  set +o pipefail
  gzip -cd "$file" | grep -Eiq "$pattern"
  local status=$?
  set -o pipefail
  return "$status"
}

[[ -f "$ENV_FILE" ]] || fail "env file not found"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
[[ -w "$BACKUP_DIR" ]] || fail "backup directory is not writable"
df -Pk "$BACKUP_DIR" >/dev/null

TMP_CNF="$(mktemp /tmp/agrios-mysql-client-XXXXXX.cnf)"
TMP_META="$(mktemp /tmp/agrios-mysql-meta-XXXXXX)"
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
if (!database) throw new Error('database name is missing');
fs.writeFileSync(cnfFile, [
  '[client]',
  `host=${url.hostname}`,
  `port=${url.port || '3306'}`,
  `user=${decodeURIComponent(url.username)}`,
  `password=${decodeURIComponent(url.password)}`,
  'default-character-set=utf8mb4',
  ''
].join('\n'), { mode: 0o600 });
fs.writeFileSync(metaFile, `DB_NAME=${JSON.stringify(database)}\n`, { mode: 0o600 });
NODE

# shellcheck disable=SC1090
source "$TMP_META"

mysql --defaults-extra-file="$TMP_CNF" --batch --skip-column-names -e "SELECT 1" "$DB_NAME" >/dev/null

COLSTAT=()
if mysqldump --help 2>/dev/null | grep -q -- '--column-statistics'; then
  COLSTAT=(--column-statistics=0)
fi

mysqldump \
  --defaults-extra-file="$TMP_CNF" \
  "${COLSTAT[@]}" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --hex-blob \
  --no-tablespaces \
  --default-character-set=utf8mb4 \
  "$DB_NAME" | gzip -c > "$TMP_OUT"

chmod 600 "$TMP_OUT"
test -s "$TMP_OUT"
gzip -t "$TMP_OUT"
gzip_contains "$TMP_OUT" 'CREATE TABLE'

for table in "${KEY_TABLES[@]}"; do
  gzip_contains "$TMP_OUT" "CREATE TABLE .*\`$table\`|Table structure for table \`$table\`" || fail "backup missing key table: $table"
done

mv "$TMP_OUT" "$OUT_FILE"
sha256sum "$OUT_FILE" > "$SHA_FILE"
chmod 600 "$OUT_FILE" "$SHA_FILE"

SIZE_BYTES="$(stat -c '%s' "$OUT_FILE" 2>/dev/null || wc -c < "$OUT_FILE")"
SHA_VALUE="$(awk '{print $1}' "$SHA_FILE")"
echo "BACKUP_FILE=$OUT_FILE"
echo "BACKUP_SIZE_BYTES=$SIZE_BYTES"
echo "BACKUP_SHA256=$SHA_VALUE"
echo "BACKUP_GZIP=ok"
echo "BACKUP_KEY_TABLES=ok"
