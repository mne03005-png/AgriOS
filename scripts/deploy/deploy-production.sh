#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="${AGRIOS_REPO_DIR:-/home/ubuntu/agrios-server}"
MOBILE_DIR="${AGRIOS_MOBILE_DIR:-/www/wwwroot/agrios.xyzwtt.com/mobile}"
MOBILE_BACKUP_ROOT="${AGRIOS_MOBILE_BACKUP_ROOT:-/www/wwwroot/agrios.xyzwtt.com}"
API_BASE="${AGRIOS_API_BASE:-https://agrios-api.xyzwtt.com/api/v1}"
DESKTOP_URL="${AGRIOS_DESKTOP_URL:-https://agrios.xyzwtt.com/}"
MOBILE_URL="${AGRIOS_MOBILE_URL:-https://agrios.xyzwtt.com/mobile/}"
LOCK_FILE="${AGRIOS_DEPLOY_LOCK:-/tmp/agrios-deploy.lock}"
DRY_RUN=false
SKIP_MOBILE=false
SKIP_BACKUP=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --skip-mobile) SKIP_MOBILE=true ;;
    --skip-backup) SKIP_BACKUP=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

log() { echo "[$(date -Is)] $*"; }
fail() { echo "ERROR: $*" >&2; exit 1; }
run() {
  log "$*"
  if [[ "$DRY_RUN" == false ]]; then
    "$@"
  fi
}
http_code() {
  curl -k -s -o /dev/null -w '%{http_code}' "$1" || echo "000"
}
wait_for_http_200() {
  local label="$1"
  local url="$2"
  local timeout_seconds="${3:-90}"
  local interval_seconds="${4:-3}"
  local elapsed=0
  local code="000"

  while (( elapsed <= timeout_seconds )); do
    code="$(http_code "$url")"
    log "WAIT_HTTP label=$label url=$url status=$code elapsed=${elapsed}s"
    if [[ "$code" == "200" ]]; then
      return 0
    fi
    if (( elapsed == timeout_seconds )); then
      break
    fi
    sleep "$interval_seconds"
    elapsed=$(( elapsed + interval_seconds ))
    if (( elapsed > timeout_seconds )); then
      elapsed="$timeout_seconds"
    fi
  done

  fail "$label failed: url=$url last_status=$code waited=${elapsed}s"
}
wait_for_pm2_online() {
  local app_name="$1"
  local timeout_seconds="${2:-90}"
  local interval_seconds="${3:-3}"
  local elapsed=0
  local status="unknown"

  while (( elapsed <= timeout_seconds )); do
    status="$(pm2 jlist 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const app=JSON.parse(d).find(x=>x.name===process.argv[1]);console.log(app?.pm2_env?.status||'missing')}catch{console.log('unknown')}})" "$app_name")"
    log "WAIT_PM2 app=$app_name status=$status elapsed=${elapsed}s"
    if [[ "$status" == "online" ]]; then
      return 0
    fi
    if (( elapsed == timeout_seconds )); then
      break
    fi
    sleep "$interval_seconds"
    elapsed=$(( elapsed + interval_seconds ))
    if (( elapsed > timeout_seconds )); then
      elapsed="$timeout_seconds"
    fi
  done

  fail "pm2 app did not become online: app=$app_name last_status=$status waited=${elapsed}s"
}

if [[ "$DRY_RUN" == false && "$SKIP_BACKUP" == true ]]; then
  echo "HIGH RISK: --skip-backup was requested for a production deployment." >&2
  echo "Type AGREE_SKIP_BACKUP to continue:" >&2
  read -r confirmation
  [[ "$confirmation" == "AGREE_SKIP_BACKUP" ]] || fail "skip-backup was not confirmed"
fi

[[ -d "$REPO_DIR/.git" ]] || fail "repository not found: $REPO_DIR"
cd "$REPO_DIR"

if command -v flock >/dev/null 2>&1; then
  exec 9>"$LOCK_FILE"
  flock -n 9 || fail "another AgriOS deployment is already running"
else
  [[ "$DRY_RUN" == true ]] || fail "flock is required for live deployment locking"
  log "DRY_RUN: flock unavailable; live deployment requires flock"
fi

if [[ "$(id -un)" != "ubuntu" ]]; then
  [[ "$DRY_RUN" == true ]] || fail "deployment must run as ubuntu"
  log "DRY_RUN: running as $(id -un); live deployment must run as ubuntu"
fi
git diff --quiet || fail "working tree has unstaged changes"
git diff --cached --quiet || fail "working tree has staged changes"

before_commit="$(git rev-parse HEAD)"
log "BEFORE_COMMIT=$before_commit"

if [[ "$DRY_RUN" == true ]]; then
  log "DRY_RUN: would fetch origin and verify fast-forward"
else
  git -c http.version=HTTP/1.1 fetch origin
fi

if [[ "$DRY_RUN" == false ]]; then
  base="$(git merge-base HEAD origin/main)"
  [[ "$base" == "$before_commit" ]] || fail "origin/main is not a fast-forward from current HEAD"
fi

if [[ "$SKIP_BACKUP" == false ]]; then
  if [[ "$DRY_RUN" == true ]]; then
    log "DRY_RUN: would run scripts/ops/backup-mysql.sh before deploy"
  else
    AGRIOS_BACKUP_DIR=/home/ubuntu/backups/agrios/pre-deploy bash scripts/ops/backup-mysql.sh
  fi
fi

run git -c http.version=HTTP/1.1 pull --ff-only origin main
run npm ci

cd "$REPO_DIR/apps/backend"
run npx prisma validate --schema prisma/schema.prisma
run npx prisma generate --schema prisma/schema.prisma
run npx prisma migrate status --schema prisma/schema.prisma || {
  if [[ "$DRY_RUN" == false ]]; then
    log "Pending migrations may exist; continuing to explicit deploy step."
  fi
}

if [[ "$DRY_RUN" == true ]]; then
  log "DRY_RUN: would inspect pending migration SQL and run prisma migrate deploy"
else
  [[ -d prisma/migrations ]] || fail "Prisma migrations directory not found"
  if find prisma/migrations -name 'migration.sql' -print0 | xargs -0 grep -Ein 'DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM|DROP DATABASE|CREATE DATABASE' >/tmp/agrios-migration-risk.txt; then
    cat /tmp/agrios-migration-risk.txt >&2
    fail "potentially destructive migration SQL found"
  fi
  npx prisma migrate deploy --schema prisma/schema.prisma
fi

cd "$REPO_DIR"
run npm --workspace @agrios/backend run build

if [[ "$SKIP_MOBILE" == false ]]; then
  run env VITE_BASE_PATH=/mobile/ VITE_API_BASE_URL="$API_BASE" npm --workspace @agrios/mobile run verify:prod-mobile
  run env VITE_BASE_PATH=/mobile/ VITE_API_BASE_URL="$API_BASE" npm --workspace @agrios/mobile run build
  if [[ "$DRY_RUN" == true ]]; then
    log "DRY_RUN: would backup and rsync mobile dist to $MOBILE_DIR"
  else
    test -s apps/mobile/dist/index.html
    test -d apps/mobile/dist/assets
    ts="$(date +%Y%m%d-%H%M%S)"
    if [[ -d "$MOBILE_DIR" ]]; then
      sudo cp -a "$MOBILE_DIR" "$MOBILE_BACKUP_ROOT/mobile.bak-deploy-$ts"
    fi
    sudo mkdir -p "$MOBILE_DIR"
    sudo rsync -a --delete apps/mobile/dist/ "$MOBILE_DIR/"
    sudo find "$MOBILE_DIR" -type d -exec chmod 755 {} \;
    sudo find "$MOBILE_DIR" -type f -exec chmod 644 {} \;
  fi
fi

run sudo nginx -t
if [[ "$DRY_RUN" == true ]]; then
  log "DRY_RUN: would reload nginx after successful test"
  log "DRY_RUN: would startOrReload ecosystem.config.cjs --only agrios-backend --update-env"
else
  sudo nginx -s reload
  pm2 startOrReload ecosystem.config.cjs --only agrios-backend --update-env
  wait_for_pm2_online agrios-backend 90 3
  pm2 save
fi

if [[ "$DRY_RUN" == true ]]; then
  log "DRY_RUN: would run health and page checks"
else
  wait_for_http_200 health_live "$API_BASE/health/live" 90 3
  wait_for_http_200 health_ready "$API_BASE/health/ready" 90 3
  wait_for_http_200 desktop "$DESKTOP_URL" 90 3
  wait_for_http_200 mobile "$MOBILE_URL" 90 3
  log "HEALTH live=200 ready=200 desktop=200 mobile=200"
fi

after_commit="$(git rev-parse HEAD)"
log "AFTER_COMMIT=$after_commit"
log "DEPLOYMENT=ok"
