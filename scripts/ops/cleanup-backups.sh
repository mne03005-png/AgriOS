#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_ROOT="${AGRIOS_BACKUP_ROOT:-/home/ubuntu/backups/agrios}"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

STAGE2_KEEP="$BACKUP_ROOT/pre-stage2/agrios-pre-stage2-20260703-141459.sql.gz"

delete_file() {
  local file="$1"
  [[ "$file" == "$STAGE2_KEEP" ]] && return 0
  [[ "$file" == *.tmp ]] && return 0
  if [[ "$DRY_RUN" == true ]]; then
    echo "WOULD_DELETE=$file"
  else
    rm -f -- "$file" "$file.sha256"
    echo "DELETED=$file"
  fi
}

delete_older_than() {
  local dir="$1"
  local days="$2"
  [[ -d "$dir" ]] || return 0
  while IFS= read -r -d '' file; do
    delete_file "$file"
  done < <(find "$dir" -maxdepth 1 -type f -name 'agrios-*.sql.gz' -mtime +"$days" -print0)
}

keep_latest_count() {
  local dir="$1"
  local prefix="$2"
  local keep="$3"
  [[ -d "$dir" ]] || return 0
  mapfile -t files < <(find "$dir" -maxdepth 1 -type f -name "$prefix*.sql.gz" -printf '%T@ %p\n' | sort -rn | awk 'NR>'"$keep"'{print $2}')
  for file in "${files[@]:-}"; do
    [[ -n "$file" ]] && delete_file "$file"
  done
}

delete_older_than "$BACKUP_ROOT/daily" 7
delete_older_than "$BACKUP_ROOT/weekly" 28
keep_latest_count "$BACKUP_ROOT/pre-deploy" "agrios-pre-deploy-" 10
keep_latest_count "$BACKUP_ROOT/pre-migration" "agrios-pre-migration-" 10

echo "CLEANUP_BACKUPS=ok"
