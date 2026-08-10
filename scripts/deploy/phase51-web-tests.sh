#!/usr/bin/env bash
set -Eeuo pipefail

base='http://127.0.0.1:3201'
asset_file='/tmp/phase51-web-app.js'
[[ ! -e "$asset_file" ]]
for route in / /login /cockpit /map /operations /profile /devices /valve-control-test /unknown-phase51-route; do
  response=$(curl -sS --max-time 10 "$base$route")
  grep -qi '<div id="app"' <<<"$response"
done
asset=$(curl -sS "$base/" | grep -Eo 'src="[^"]+\.js"' | head -1 | cut -d'"' -f2)
code=$(curl -sS -o "$asset_file" -w '%{http_code}' --max-time 10 "$base$asset")
[[ "$code" == 200 ]]
grep -q 'https://agrios-api.xyzwtt.com/api/v1' "$asset_file"
allowed=$(curl -sS -o /dev/null -D - -H 'Origin: https://agrios.xyzwtt.com' http://127.0.0.1:3200/api/v1/health/live | awk -F': ' 'tolower($1)=="access-control-allow-origin" {gsub(/\r/,"",$2);print $2}')
denied=$(curl -sS -o /dev/null -D - -H 'Origin: https://evil.invalid' http://127.0.0.1:3200/api/v1/health/live | awk -F': ' 'tolower($1)=="access-control-allow-origin" {gsub(/\r/,"",$2);print $2}')
[[ "$allowed" == 'https://agrios.xyzwtt.com' && -z "$denied" ]]
echo "PASS Web SPA routes, asset=${asset}, CORS allow/deny"
echo 'INFO Web bundle still targets public API; browser end-to-end gray routing remains a cutover-stage check'
