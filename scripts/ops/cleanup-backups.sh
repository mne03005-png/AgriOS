#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_ROOT="${AGRIOS_BACKUP_ROOT:-/home/ubuntu/backups/agrios}"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
PLANNED_DELETE_COUNT=0

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

normalize_path() {
  realpath -m -- "$1"
}

assert_safe_root() {
  [[ -n "$BACKUP_ROOT" ]] || fail "AGRIOS_BACKUP_ROOT is empty"

  BACKUP_ROOT="$(normalize_path "$BACKUP_ROOT")"
  case "$BACKUP_ROOT" in
    /|/home|/home/ubuntu)
      fail "refusing dangerous backup root: $BACKUP_ROOT"
      ;;
  esac

  if [[ -n "$REPO_ROOT" && "$BACKUP_ROOT" == "$(normalize_path "$REPO_ROOT")" ]]; then
    fail "refusing repository root as backup root: $BACKUP_ROOT"
  fi

  [[ -d "$BACKUP_ROOT" ]] || fail "backup root does not exist: $BACKUP_ROOT"
  [[ ! -L "$BACKUP_ROOT" ]] || fail "backup root must not be a symlink: $BACKUP_ROOT"
}

assert_under_root() {
  local file="$1"
  local normalized
  normalized="$(normalize_path "$file")"
  case "$normalized" in
    "$BACKUP_ROOT"/*) ;;
    *) fail "refusing path outside backup root: $file" ;;
  esac
  [[ ! -L "$file" ]] || fail "refusing symlink file: $file"
}

STAGE2_KEEP="$BACKUP_ROOT/pre-stage2/agrios-pre-stage2-20260703-141459.sql.gz"

delete_file() {
  local file="$1"
  assert_under_root "$file"
  [[ "$file" == "$STAGE2_KEEP" ]] && return 0
  [[ "$file" == *.tmp ]] && return 0

  PLANNED_DELETE_COUNT=$((PLANNED_DELETE_COUNT + 1))
  if [[ "$DRY_RUN" == true ]]; then
    echo "WOULD_DELETE=$file"
  else
    rm -f -- "$file" "$file.sha256"
    echo "DELETED=$file"
  fi
}

scan_dir() {
  local dir="$1"
  local retention="$2"
  echo "SCAN_DIR=$dir RETENTION=$retention DRY_RUN=$DRY_RUN"
  [[ -d "$dir" ]] || return 0
  [[ ! -L "$dir" ]] || fail "refusing symlink directory: $dir"
  assert_under_root "$dir/.agrios-root-check"
}

delete_older_than() {
  local dir="$1"
  local days="$2"
  scan_dir "$dir" "mtime>${days}d"
  [[ -d "$dir" ]] || return 0

  while IFS= read -r -d '' file; do
    delete_file "$file"
  done < <(find "$dir" -maxdepth 1 -type f -name 'agrios-*.sql.gz' -mtime +"$days" -print0)
}

keep_latest_count() {
  local dir="$1"
  local prefix="$2"
  local keep="$3"
  local files=()
  scan_dir "$dir" "keep_latest=$keep prefix=$prefix"
  [[ -d "$dir" ]] || return 0

  mapfile -t files < <(find "$dir" -maxdepth 1 -type f -name "$prefix*.sql.gz" -printf '%T@ %p\n' | sort -rn | awk 'NR>'"$keep"'{print $2}')
  for file in "${files[@]}"; do
    delete_file "$file"
  done
}

assert_safe_root

delete_older_than "$BACKUP_ROOT/daily" 7
delete_older_than "$BACKUP_ROOT/weekly" 28
keep_latest_count "$BACKUP_ROOT/pre-deploy" "agrios-pre-deploy-" 10
keep_latest_count "$BACKUP_ROOT/pre-migration" "agrios-pre-migration-" 10

echo "DELETE_PLAN_COUNT=$PLANNED_DELETE_COUNT"
echo "CLEANUP_BACKUPS=ok"
