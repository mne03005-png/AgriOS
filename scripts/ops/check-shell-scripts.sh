#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

failures=0

check_file() {
  local file="$1"
  local first_line

  if LC_ALL=C head -c 3 "$file" | grep -q $'^\357\273\277'; then
    echo "BOM_FOUND=$file" >&2
    failures=$((failures + 1))
  fi

  if LC_ALL=C grep -q $'\r' "$file"; then
    echo "CRLF_FOUND=$file" >&2
    failures=$((failures + 1))
  fi

  first_line="$(head -n 1 "$file")"
  if [[ "$first_line" != '#!'* ]]; then
    echo "BAD_SHEBANG=$file" >&2
    failures=$((failures + 1))
  fi

  if ! bash -n "$file"; then
    echo "BASH_N_FAILED=$file" >&2
    failures=$((failures + 1))
  fi
}

while IFS= read -r file; do
  check_file "$file"
done < <(find scripts -type f -name '*.sh' | sort)

if (( failures > 0 )); then
  echo "SHELL_SCRIPT_CHECK=failed failures=$failures" >&2
  exit 1
fi

echo "SHELL_SCRIPT_CHECK=ok"
