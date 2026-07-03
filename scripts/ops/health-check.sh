#!/usr/bin/env bash
set -Eeuo pipefail

LOCK_FILE="${AGRIOS_HEALTH_LOCK:-/tmp/agrios-health-check.lock}"
LOG_DIR="${AGRIOS_HEALTH_LOG_DIR:-/home/ubuntu/agrios-ops/logs}"
LOG_FILE="$LOG_DIR/health-check.log"
API_BASE="${AGRIOS_API_BASE:-https://agrios-api.xyzwtt.com/api/v1}"
DESKTOP_URL="${AGRIOS_DESKTOP_URL:-https://agrios.xyzwtt.com/}"
MOBILE_URL="${AGRIOS_MOBILE_URL:-https://agrios.xyzwtt.com/mobile/}"
REPO_DIR="${AGRIOS_REPO_DIR:-/home/ubuntu/agrios-server}"
BACKUP_DIR="${AGRIOS_BACKUP_DIR:-/home/ubuntu/backups/agrios/daily}"

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"

if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    echo "health-check already running"
    exit 0
  fi
else
  echo "health-check lock unavailable; continuing without flock"
fi

status="OK"
warnings=()
criticals=()

add_warning() { warnings+=("$1"); [[ "$status" == "OK" ]] && status="WARNING"; }
add_critical() { criticals+=("$1"); status="CRITICAL"; }

http_code() {
  curl -k -s -o /dev/null -w '%{http_code}' "$1" || echo "000"
}

live="$(http_code "$API_BASE/health/live")"
ready="$(http_code "$API_BASE/health/ready")"
desktop="$(http_code "$DESKTOP_URL")"
mobile="$(http_code "$MOBILE_URL")"

[[ "$live" == "200" ]] || add_critical "live_http_$live"
[[ "$ready" == "200" ]] || add_critical "ready_http_$ready"
[[ "$desktop" == "200" ]] || add_critical "desktop_http_$desktop"
[[ "$mobile" == "200" ]] || add_critical "mobile_http_$mobile"

pm2_state="$(pm2 jlist 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const app=JSON.parse(d).find(x=>x.name==='agrios-backend');console.log(app?.pm2_env?.status||'missing');}catch{console.log('unknown')}})")"
pm2_restarts="$(pm2 jlist 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const app=JSON.parse(d).find(x=>x.name==='agrios-backend');console.log(app?.pm2_env?.restart_time??'unknown');}catch{console.log('unknown')}})")"
[[ "$pm2_state" == "online" ]] || add_critical "pm2_agrios_backend_$pm2_state"

disk_pct="$(df -P "$REPO_DIR" | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
inode_pct="$(df -Pi "$REPO_DIR" | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
if command -v free >/dev/null 2>&1; then
  mem_pct="$(free | awk '/Mem:/ {printf "%.0f", ($2-$7)*100/$2}')"
else
  mem_pct="unknown"
fi

if [[ "$disk_pct" =~ ^[0-9]+$ ]]; then
  (( disk_pct > 90 )) && add_critical "disk_${disk_pct}pct"
  (( disk_pct > 80 && disk_pct <= 90 )) && add_warning "disk_${disk_pct}pct"
fi
if [[ "$inode_pct" =~ ^[0-9]+$ ]]; then
  (( inode_pct > 90 )) && add_critical "inode_${inode_pct}pct"
  (( inode_pct > 80 && inode_pct <= 90 )) && add_warning "inode_${inode_pct}pct"
fi

latest_backup="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'agrios-*.sql.gz' -printf '%T@ %p\n' 2>/dev/null | sort -rn | awk 'NR==1 {print $2}')"
backup_age_hours="missing"
backup_verify="missing"
if [[ -n "$latest_backup" ]]; then
  now="$(date +%s)"
  mtime="$(stat -c '%Y' "$latest_backup")"
  backup_age_hours="$(( (now - mtime) / 3600 ))"
  if (( backup_age_hours > 36 )); then add_critical "backup_age_${backup_age_hours}h"; fi
  if "$(dirname "$0")/verify-backup.sh" "$latest_backup" >/dev/null 2>&1; then
    backup_verify="ok"
  else
    backup_verify="failed"
    add_critical "backup_verify_failed"
  fi
else
  add_critical "backup_missing"
fi

commit="unknown"
if [[ -d "$REPO_DIR/.git" ]]; then
  commit="$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"
fi

summary="timestamp=$(date -Is) status=$status live=$live ready=$ready desktop=$desktop mobile=$mobile pm2=$pm2_state restarts=$pm2_restarts disk=${disk_pct}% inode=${inode_pct}% memory=${mem_pct}% backup_age_hours=$backup_age_hours backup_verify=$backup_verify commit=$commit warnings=${warnings[*]:-none} criticals=${criticals[*]:-none}"
echo "$summary" | tee -a "$LOG_FILE"

[[ "$status" != "CRITICAL" ]]
