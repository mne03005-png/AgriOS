#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

cleanup_script="$repo_root/scripts/ops/cleanup-backups.sh"
tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/agrios-cleanup-test-XXXXXX")"
trap 'rm -rf -- "$tmp_root"' EXIT

assert_exists() {
  [[ -e "$1" ]] || {
    echo "ASSERT_EXISTS_FAILED=$1" >&2
    exit 1
  }
}

assert_missing() {
  [[ ! -e "$1" ]] || {
    echo "ASSERT_MISSING_FAILED=$1" >&2
    exit 1
  }
}

make_backup() {
  local file="$1"
  local age_days="${2:-0}"
  mkdir -p "$(dirname "$file")"
  printf 'CREATE TABLE test_%s (id int);\n' "$(basename "$file" | tr -cd '[:alnum:]')" | gzip -c >"$file"
  printf '%s  %s\n' "$(sha256sum "$file" | awk '{print $1}')" "$(basename "$file")" >"$file.sha256"
  if (( age_days > 0 )); then
    touch -d "$age_days days ago" "$file" "$file.sha256"
  fi
}

run_cleanup() {
  if [[ $# -gt 1 ]]; then
    AGRIOS_BACKUP_ROOT="$1" bash "$cleanup_script" "$2"
  else
    AGRIOS_BACKUP_ROOT="$1" bash "$cleanup_script"
  fi
}

empty_root="$tmp_root/empty"
mkdir -p "$empty_root"
output="$(run_cleanup "$empty_root" --dry-run)"
[[ "$output" == *"CLEANUP_BACKUPS=ok"* ]]

daily_root="$tmp_root/daily-only"
make_backup "$daily_root/daily/agrios-old.sql.gz" 10
make_backup "$daily_root/daily/agrios-new.sql.gz" 1
output="$(run_cleanup "$daily_root" --dry-run)"
[[ "$output" == *"WOULD_DELETE="* ]]
assert_exists "$daily_root/daily/agrios-old.sql.gz"
assert_exists "$daily_root/daily/agrios-new.sql.gz"
run_cleanup "$daily_root" >/dev/null
assert_missing "$daily_root/daily/agrios-old.sql.gz"
assert_missing "$daily_root/daily/agrios-old.sql.gz.sha256"
assert_exists "$daily_root/daily/agrios-new.sql.gz"
run_cleanup "$daily_root" >/dev/null

empty_subdirs_root="$tmp_root/empty-subdirs"
mkdir -p "$empty_subdirs_root/pre-deploy" "$empty_subdirs_root/pre-migration"
output="$(run_cleanup "$empty_subdirs_root" --dry-run)"
[[ "$output" == *"DELETE_PLAN_COUNT=0"* ]]

retention_root="$tmp_root/retention"
mkdir -p "$retention_root/pre-deploy" "$retention_root/pre-migration"
for i in $(seq 1 12); do
  make_backup "$retention_root/pre-deploy/agrios-pre-deploy-$i.sql.gz" 0
  touch -d "$i minutes ago" "$retention_root/pre-deploy/agrios-pre-deploy-$i.sql.gz" "$retention_root/pre-deploy/agrios-pre-deploy-$i.sql.gz.sha256"
done
run_cleanup "$retention_root" >/dev/null
remaining_count="$(find "$retention_root/pre-deploy" -maxdepth 1 -type f -name 'agrios-pre-deploy-*.sql.gz' | wc -l | tr -d ' ')"
[[ "$remaining_count" == "10" ]] || {
  echo "ASSERT_RETAIN_COUNT_FAILED=$remaining_count" >&2
  exit 1
}

danger_root="$tmp_root/danger"
mkdir -p "$danger_root"
if AGRIOS_BACKUP_ROOT="/" bash "$cleanup_script" --dry-run >/dev/null 2>&1; then
  echo "ASSERT_DANGEROUS_ROOT_FAILED" >&2
  exit 1
fi

symlink_root="$tmp_root/symlink-root"
outside_root="$tmp_root/outside"
mkdir -p "$symlink_root/daily" "$outside_root"
printf 'outside\n' >"$outside_root/file.sql.gz"
if ln -s "$outside_root/file.sql.gz" "$symlink_root/daily/agrios-link.sql.gz" 2>/dev/null; then
  run_cleanup "$symlink_root" --dry-run >/dev/null
  assert_exists "$outside_root/file.sql.gz"
fi

echo "CLEANUP_BACKUPS_TEST=ok"
