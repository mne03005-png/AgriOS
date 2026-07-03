#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${AGRIOS_REPO_DIR:-/home/ubuntu/agrios-server}"
BEGIN="# BEGIN AgriOS ops jobs"
END="# END AgriOS ops jobs"
TMP_CURRENT="$(mktemp)"
TMP_NEXT="$(mktemp)"
trap 'rm -f "$TMP_CURRENT" "$TMP_NEXT"' EXIT

crontab -l > "$TMP_CURRENT" 2>/dev/null || true

awk -v begin="$BEGIN" -v end="$END" '
  $0 == begin {skip=1; next}
  $0 == end {skip=0; next}
  skip != 1 {print}
' "$TMP_CURRENT" > "$TMP_NEXT"

cat >> "$TMP_NEXT" <<EOF
$BEGIN
30 2 * * * cd $REPO_DIR && bash scripts/ops/backup-mysql.sh >> /home/ubuntu/agrios-ops/logs/backup.log 2>&1
30 3 * * * cd $REPO_DIR && bash scripts/ops/cleanup-backups.sh >> /home/ubuntu/agrios-ops/logs/backup-cleanup.log 2>&1
*/5 * * * * cd $REPO_DIR && bash scripts/ops/health-check.sh >> /home/ubuntu/agrios-ops/logs/health-check-cron.log 2>&1
# Manual restore drill command:
# cd $REPO_DIR && bash scripts/ops/restore-backup-test.sh /home/ubuntu/backups/agrios/daily/<backup>.sql.gz
$END
EOF

crontab "$TMP_NEXT"
echo "CRON_INSTALL=ok"
