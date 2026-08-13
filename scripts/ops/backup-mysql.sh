#!/usr/bin/env bash
set -Eeuo pipefail

# Backs up the AgriOS production MySQL database directly from its Docker
# container by exact name, via `docker exec ... mysqldump`. This deliberately
# never touches any host TCP port (not 127.0.0.1:3306 or any other) -- a
# prior incident showed the daily backup silently targeting an unrelated
# MySQL instance that happened to also be listening on host port 3306,
# because the old approach resolved its target from a DATABASE_URL in a
# stale host-checkout .env file instead of asking the actual container what
# it is. Resolving the target by container name removes that entire class of
# failure: if the named container is missing/stopped/unhealthy, this script
# fails loudly instead of silently backing up whatever else answers on a port.
MYSQL_CONTAINER="${AGRIOS_MYSQL_CONTAINER:-agrios-gray-agrios-mysql-1}"
BACKUP_DIR="${AGRIOS_BACKUP_DIR:-/home/ubuntu/backups/agrios/live-docker}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="$BACKUP_DIR/agrios-live-docker-$TIMESTAMP.sql.gz"
SHA_FILE="$OUT_FILE.sha256"
TMP_OUT="$OUT_FILE.tmp"

KEY_TABLES=(User Tenant Farm TenantFarm Field Device _prisma_migrations)

cleanup() {
  local status=$?
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

require_command docker
require_command gzip
require_command sha256sum

gzip_contains() {
  local file="$1"
  local pattern="$2"
  set +o pipefail
  gzip -cd "$file" | grep -Eiq "$pattern"
  local status=$?
  set -o pipefail
  return "$status"
}

# Fail closed: the named container must exist and actually be running. No
# fallback to any other container or host port is attempted under any
# circumstance -- an absent/stopped/unhealthy target is a hard failure.
CONTAINER_STATE="$(docker inspect -f '{{.State.Running}}' "$MYSQL_CONTAINER" 2>/dev/null)" \
  || fail "expected AgriOS database container not found: $MYSQL_CONTAINER"
[[ "$CONTAINER_STATE" == "true" ]] || fail "$MYSQL_CONTAINER is not running (state=$CONTAINER_STATE)"

HEALTH_STATUS="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$MYSQL_CONTAINER" 2>/dev/null)"
if [[ "$HEALTH_STATUS" != "none" && "$HEALTH_STATUS" != "healthy" ]]; then
  fail "$MYSQL_CONTAINER health status is '$HEALTH_STATUS', expected healthy"
fi

IMAGE_REF="$(docker inspect -f '{{.Config.Image}}' "$MYSQL_CONTAINER" 2>/dev/null || echo unknown)"
echo "TARGET_CONTAINER=$MYSQL_CONTAINER"
echo "TARGET_IMAGE=$IMAGE_REF"
echo "TARGET_HEALTH=$HEALTH_STATUS"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
[[ -w "$BACKUP_DIR" ]] || fail "backup directory is not writable"
df -Pk "$BACKUP_DIR" >/dev/null

DB_NAME="$(docker exec "$MYSQL_CONTAINER" sh -c 'echo "$MYSQL_DATABASE"')"
[[ -n "$DB_NAME" ]] || fail "could not resolve MYSQL_DATABASE from $MYSQL_CONTAINER"
echo "TARGET_DATABASE=$DB_NAME"

COLSTAT=()
if docker exec "$MYSQL_CONTAINER" mysqldump --help 2>/dev/null | grep -q -- '--column-statistics'; then
  COLSTAT=(--column-statistics=0)
fi

# Credentials are read from the container's own environment and used only
# inside the container process -- never echoed, never written to a host file.
DUMP_STDERR="/tmp/agrios-backup-mysqldump-stderr.$$"
set +o pipefail
docker exec "$MYSQL_CONTAINER" sh -c '
  mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" '"${COLSTAT[*]}"' \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    --events \
    --hex-blob \
    --no-tablespaces \
    --default-character-set=utf8mb4 \
    "$MYSQL_DATABASE"
' 2>"$DUMP_STDERR" | gzip -c > "$TMP_OUT"
DUMP_PIPE_STATUS=("${PIPESTATUS[@]}")
set -o pipefail

if grep -qv 'Using a password on the command line interface can be insecure' "$DUMP_STDERR" 2>/dev/null; then
  cat "$DUMP_STDERR" >&2
fi
rm -f "$DUMP_STDERR"
[[ "${DUMP_PIPE_STATUS[0]}" == "0" ]] || fail "mysqldump exited non-zero (${DUMP_PIPE_STATUS[0]}) against $MYSQL_CONTAINER"
[[ "${DUMP_PIPE_STATUS[1]}" == "0" ]] || fail "gzip compression exited non-zero (${DUMP_PIPE_STATUS[1]})"

chmod 600 "$TMP_OUT"
test -s "$TMP_OUT" || fail "backup file is empty"
gzip -t "$TMP_OUT" || fail "backup gzip integrity check failed"
gzip_contains "$TMP_OUT" 'CREATE TABLE' || fail "backup does not contain any CREATE TABLE statement"

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
