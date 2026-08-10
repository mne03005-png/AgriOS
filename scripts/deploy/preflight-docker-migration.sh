#!/usr/bin/env bash
set -Eeuo pipefail

# Read-only preflight for the PM2-to-Docker migration. This script never
# starts containers, applies migrations, reloads Nginx, or changes PM2.

REPO_DIR="${AGRIOS_REPO_DIR:-/home/ubuntu/agrios-server}"
COMPOSE_FILE="${AGRIOS_COMPOSE_FILE:-docker-compose.production.yml}"
ENV_FILE="${AGRIOS_ENV_FILE:-.env.production}"
BACKUP_DIR="${AGRIOS_BACKUP_DIR:-/home/ubuntu/backups/agrios/daily}"
BAOTA_NGINX="${AGRIOS_BAOTA_NGINX:-/www/server/nginx/sbin/nginx}"
BAOTA_NGINX_CONF="${AGRIOS_BAOTA_NGINX_CONF:-/www/server/nginx/conf/nginx.conf}"
API_URL="${AGRIOS_API_URL:-https://agrios-api.xyzwtt.com/api/v1}"
PM2_APP="${AGRIOS_PM2_APP:-agrios-backend}"

failures=0
warnings=0

ok() { printf 'OK: %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*"; warnings=$((warnings + 1)); }
fail() { printf 'FAIL: %s\n' "$*" >&2; failures=$((failures + 1)); }
require_command() {
  if command -v "$1" >/dev/null 2>&1; then ok "command available: $1"; else fail "command missing: $1"; fi
}
http_code() {
  curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 10 "$1" 2>/dev/null || printf '000'
}

printf '%s\n' 'AgriOS Docker migration preflight (read-only)'
printf 'timestamp=%s\n' "$(date -Is)"

for command_name in docker git curl node npm pm2; do require_command "$command_name"; done

if [[ ! -d "$REPO_DIR/.git" ]]; then
  fail "repository not found: $REPO_DIR"
  printf 'PREFLIGHT=failed failures=%d warnings=%d\n' "$failures" "$warnings"
  exit 1
fi
cd "$REPO_DIR"

printf 'commit=%s\n' "$(git rev-parse HEAD)"
if [[ -n "$(git status --porcelain)" ]]; then
  warn 'working tree is not clean; review every local file before migration'
  git status --short
else
  ok 'working tree is clean'
fi

if [[ ! -r "$ENV_FILE" ]]; then
  fail "Compose environment file is not readable: $ENV_FILE"
else
  mode="$(stat -c '%a' "$ENV_FILE")"
  if [[ "$mode" == '600' ]]; then
    ok "$ENV_FILE permissions are 600"
  else
    warn "$ENV_FILE permissions are $mode, expected 600"
  fi
  placeholder_keys="$(awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/ && ($0 ~ /CHANGE_ME|changeme|example/){print $1}' "$ENV_FILE")"
  if [[ -n "$placeholder_keys" ]]; then
    fail "placeholder values remain in $ENV_FILE keys: $(tr '\n' ' ' <<<"$placeholder_keys")"
  else
    ok "$ENV_FILE contains no recognized placeholder values"
  fi
  image_tag="$(awk -F= '$1 == "AGRIOS_IMAGE_TAG" {print substr($0, index($0, "=") + 1)}' "$ENV_FILE" | tail -1)"
  if [[ -z "$image_tag" || "$image_tag" == 'production' || "$image_tag" == 'latest' ]]; then
    fail 'AGRIOS_IMAGE_TAG must be an immutable release identifier such as a Git SHA'
  else
    ok "AGRIOS_IMAGE_TAG is immutable-looking: $image_tag"
  fi
fi

if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet; then
  ok 'Docker Compose configuration renders successfully'
else
  fail 'Docker Compose configuration is invalid'
fi

if docker info >/dev/null 2>&1; then
  ok "Docker daemon available: $(docker version --format '{{.Server.Version}}')"
else
  fail 'Docker daemon is unavailable'
fi

for port in 3200 3201 8883; do
  if ss -H -lnt "sport = :$port" 2>/dev/null | grep -q .; then
    fail "required migration port is already listening: $port"
  else
    ok "required migration port is free: $port"
  fi
done

pm2_state="$(pm2 jlist 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const a=JSON.parse(d).find(x=>x.name===process.argv[1]);console.log(a?.pm2_env?.status||'missing')}catch{console.log('unknown')}})" "$PM2_APP")"
if [[ "$pm2_state" == 'online' ]]; then ok "PM2 rollback target is online: $PM2_APP"; else fail "PM2 rollback target state is $pm2_state"; fi

live="$(http_code "$API_URL/health/live")"
ready="$(http_code "$API_URL/health/ready")"
if [[ "$live" == '200' ]]; then ok 'current public live endpoint returns 200'; else fail "current public live endpoint returned $live"; fi
if [[ "$ready" == '200' ]]; then ok 'current public ready endpoint returns 200'; else fail "current public ready endpoint returned $ready"; fi

latest_backup="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'agrios-*.sql.gz' -printf '%T@ %p\n' 2>/dev/null | sort -rn | awk 'NR==1 {$1=""; sub(/^ /,""); print}')"
if [[ -z "$latest_backup" ]]; then
  fail "no database backup found in $BACKUP_DIR"
else
  backup_age_hours=$(( ($(date +%s) - $(stat -c '%Y' "$latest_backup")) / 3600 ))
  if (( backup_age_hours <= 36 )); then ok "latest backup age is ${backup_age_hours}h"; else fail "latest backup is ${backup_age_hours}h old"; fi
  if [[ -r scripts/ops/verify-backup.sh ]] && bash scripts/ops/verify-backup.sh "$latest_backup" >/dev/null 2>&1; then
    ok 'latest database backup passes verification'
  else
    fail 'latest database backup verification failed'
  fi
fi

if (cd apps/backend && ../../node_modules/.bin/prisma migrate status --schema prisma/schema.prisma >/dev/null); then
  ok 'current database Prisma migration status is readable and current'
else
  fail 'current database Prisma migration status is not current or cannot be read'
fi

if [[ -x "$BAOTA_NGINX" ]] && sudo -n "$BAOTA_NGINX" -t -c "$BAOTA_NGINX_CONF" >/dev/null 2>&1; then
  ok 'active BaoTa Nginx configuration test passes'
else
  fail 'active BaoTa Nginx configuration test failed or requires unavailable sudo'
fi

for certificate_name in agrios.xyzwtt.com agrios-api.xyzwtt.com; do
  certificate="/etc/letsencrypt/live/$certificate_name/fullchain.pem"
  if sudo -n test -r "$certificate" && sudo -n openssl x509 -checkend 2592000 -noout -in "$certificate" >/dev/null 2>&1; then
    ok "certificate remains valid for at least 30 days: $certificate_name"
  else
    fail "certificate missing or expires within 30 days: $certificate_name"
  fi
done

disk_pct="$(df -P "$REPO_DIR" | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
available_mb="$(awk '/MemAvailable:/ {printf "%d", $2/1024}' /proc/meminfo)"
if (( disk_pct < 80 )); then ok "disk usage is ${disk_pct}%"; else fail "disk usage is ${disk_pct}%"; fi
if (( available_mb >= 1536 )); then
  ok "available memory is ${available_mb} MiB"
else
  warn "available memory is only ${available_mb} MiB; build images serially"
fi

if (( failures > 0 )); then
  printf 'PREFLIGHT=failed failures=%d warnings=%d\n' "$failures" "$warnings"
  exit 1
fi

printf 'PREFLIGHT=passed failures=0 warnings=%d\n' "$warnings"
