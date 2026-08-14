#!/usr/bin/env bash
set -Eeuo pipefail

# PROD-USABILITY-1 regression guard.
#
# Root cause proven in production: scripts/deploy/import-gray-database.sh restored a SQL backup
# via a raw `mysql -uroot -p"$MYSQL_ROOT_PASSWORD" agrios` pipe with no charset specified. MySQL's
# client library defaults an unspecified connection to latin1 -- NOT the server/database's
# utf8mb4 -- so every multi-byte Chinese character in the (correctly UTF-8-encoded) dump was
# silently replaced with a literal '?' byte on the way in. The dump/schema/columns were never
# wrong; only this one unflagged client connection was. This script fails the build if any
# scripts/**/*.sh file invokes `mysql` with direct `-u`/-uUSER credentials on the same line
# without also specifying --default-character-set=utf8mb4, so this exact class of bug cannot
# silently reappear in a new or edited script.
#
# A `mysql --defaults-extra-file=...` invocation is exempt from this line-level check (the
# charset is expected to live in the referenced option file instead, as
# scripts/ops/restore-backup-test.sh does), but every option file scripts/ writes must itself set
# default-character-set=utf8mb4 -- checked separately below.

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

failures=0

while IFS= read -r file; do
  # Direct-credential mysql invocations: -u/-uroot/-u"$VAR" style. Split each matching line's
  # occurrences so a file with both a safe and unsafe invocation is still caught per-occurrence.
  # Comment-only lines (trimmed leading whitespace starts with #) are prose, not real
  # invocations, and are skipped -- this file's own explanatory header would otherwise
  # false-positive on itself.
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    if [[ "$line" == *'mysql '*'-u'* ]] && [[ "$line" != *'--defaults-extra-file'* ]]; then
      if [[ "$line" != *'--default-character-set=utf8mb4'* ]]; then
        echo "UNSAFE_MYSQL_CHARSET=$file: $line" >&2
        failures=$((failures + 1))
      fi
    fi
  done < <(grep -v '^\s*#' "$file" 2>/dev/null | grep -o 'mysql[^|]*' || true)
done < <(find scripts -type f -name '*.sh' | sort)

# Every heredoc/here-doc-style .cnf generator scripts/ writes for --defaults-extra-file must
# itself set default-character-set=utf8mb4 (restore-backup-test.sh's Node-generated .cnf is the
# only current instance; this check fails loudly if a future one omits it).
while IFS= read -r file; do
  if grep -q 'defaults-extra-file' "$file" && ! grep -q 'default-character-set=utf8mb4' "$file"; then
    echo "UNSAFE_DEFAULTS_FILE=$file: uses --defaults-extra-file but never writes default-character-set=utf8mb4" >&2
    failures=$((failures + 1))
  fi
done < <(find scripts -type f -name '*.sh' | sort)

if (( failures > 0 )); then
  echo "MYSQL_CHARSET_SAFETY_CHECK=failed failures=$failures" >&2
  exit 1
fi

echo "MYSQL_CHARSET_SAFETY_CHECK=ok"
