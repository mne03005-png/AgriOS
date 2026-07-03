#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_FILE="${1:-}"
KEY_TABLES=(User Tenant Farm TenantFarm Field Device _prisma_migrations)

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

gzip_contains() {
  local file="$1"
  local pattern="$2"
  set +o pipefail
  gzip -cd "$file" | grep -Eiq "$pattern"
  local status=$?
  set -o pipefail
  return "$status"
}

[[ -n "$BACKUP_FILE" ]] || fail "usage: verify-backup.sh <backup.sql.gz>"
[[ -f "$BACKUP_FILE" ]] || fail "backup file not found"
[[ -s "$BACKUP_FILE" ]] || fail "backup file is empty"
command -v gzip >/dev/null 2>&1 || fail "gzip is required"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required"

perm="$(stat -c '%a' "$BACKUP_FILE" 2>/dev/null || echo unknown)"
case "$perm" in
  600|640|400|440) ;;
  644)
    case "$(uname -s)" in
      MINGW*|MSYS*|CYGWIN*) ;;
      *) fail "backup file permissions are too open: $perm" ;;
    esac
    ;;
  *) fail "backup file permissions are too open: $perm" ;;
esac

gzip -t "$BACKUP_FILE"

if [[ -f "$BACKUP_FILE.sha256" ]]; then
  (cd "$(dirname "$BACKUP_FILE")" && sha256sum -c "$(basename "$BACKUP_FILE").sha256" >/dev/null)
else
  sha256sum "$BACKUP_FILE" >/dev/null
fi

gzip_contains "$BACKUP_FILE" 'CREATE TABLE' || fail "backup does not contain schema"
gzip_contains "$BACKUP_FILE" 'mysqldump|MySQL dump|MariaDB dump' || fail "backup does not look like a MySQL dump"

for table in "${KEY_TABLES[@]}"; do
  gzip_contains "$BACKUP_FILE" "CREATE TABLE .*\`$table\`|Table structure for table \`$table\`" || fail "backup missing key table: $table"
done

echo "VERIFY_BACKUP=ok"
echo "BACKUP_FILE=$BACKUP_FILE"
echo "BACKUP_SHA256=$(sha256sum "$BACKUP_FILE" | awk '{print $1}')"
echo "BACKUP_KEY_TABLES=ok"
