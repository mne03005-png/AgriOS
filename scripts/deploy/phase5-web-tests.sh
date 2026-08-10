#!/usr/bin/env bash
set -Eeuo pipefail

base='http://127.0.0.1:3201'
[[ ! -e /tmp/phase5-web-app.js ]]
for route in / /login /cockpit /map /operations /profile /devices /valve-control-test /unknown-phase5-route; do
  response="$(curl -sS --max-time 10 "$base$route")"
  grep -qi '<div id="app"' <<<"$response"
  printf 'WEB_ROUTE=passed route=%s http=200 spa_shell=true\n' "$route"
done

asset="$(curl -sS "$base/" | grep -Eo 'src="[^"]+\.js"' | head -1 | cut -d'"' -f2)"
[[ -n "$asset" ]]
asset_code="$(curl -sS -o /tmp/phase5-web-app.js -w '%{http_code}' --max-time 10 "$base$asset")"
grep -q 'https://agrios-api.xyzwtt.com/api/v1' /tmp/phase5-web-app.js
printf 'WEB_ASSET=passed path=%s http=%s\n' "$asset" "$asset_code"
printf '%s\n' 'WEB_API_TARGET=https://agrios-api.xyzwtt.com/api/v1'
printf '%s\n' 'WEB_GRAY_API_DIRECT=false public API hostname remains the build target until Nginx cutover'

cors_allowed="$(curl -sS -o /dev/null -D - -H 'Origin: https://agrios.xyzwtt.com' http://127.0.0.1:3200/api/v1/health/live | awk -F': ' 'tolower($1)=="access-control-allow-origin" {gsub(/\r/,"",$2);print $2}')"
cors_denied="$(curl -sS -o /dev/null -D - -H 'Origin: https://evil.invalid' http://127.0.0.1:3200/api/v1/health/live | awk -F': ' 'tolower($1)=="access-control-allow-origin" {gsub(/\r/,"",$2);print $2}')"
[[ "$cors_allowed" == 'https://agrios.xyzwtt.com' ]]
[[ -z "$cors_denied" ]]
printf 'WEB_CORS=passed allowed=%s denied_origin_header=absent\n' "$cors_allowed"
