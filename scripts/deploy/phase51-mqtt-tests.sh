#!/usr/bin/env bash
set -Eeuo pipefail

cd /home/ubuntu/agrios-docker-gray
compose=(docker compose --env-file .env.gray -f docker-compose.production.yml -f docker-compose.gray.yml)
client='phase51b-device'
role='phase51b-device-role'
auditor='phase51b-auditor'
auditor_role='phase51b-auditor-role'
allowed='agrios/phase51b-tenant/devices/phase51b-device/telemetry'
forbidden='agrios/phase51b-other/private'
client_password=$(openssl rand -hex 24)
auditor_password=$(openssl rand -hex 24)

admin() {
  "${compose[@]}" exec -T agrios-mosquitto sh -c \
    'mosquitto_ctrl -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" dynsec "$@"' \
    phase51 "$@"
}

for identity in "$client" "$auditor"; do
  if admin listClients | grep -qx "$identity"; then
    echo "Refusing to overwrite existing MQTT test client: $identity" >&2
    exit 1
  fi
done

admin createClient "$client" -p "$client_password"
admin createRole "$role"
for acl in publishClientSend publishClientReceive subscribeLiteral unsubscribeLiteral; do
  admin addRoleACL "$role" "$acl" "$allowed" allow
done
admin addClientRole "$client" "$role"

admin createClient "$auditor" -p "$auditor_password"
admin createRole "$auditor_role"
for acl in publishClientReceive subscribeLiteral unsubscribeLiteral; do
  admin addRoleACL "$auditor_role" "$acl" "$forbidden" allow
done
admin addClientRole "$auditor" "$auditor_role"

"${compose[@]}" exec -T -e P="$client_password" -e T="$allowed" agrios-mosquitto sh -c '
  timeout 10 mosquitto_sub -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u phase51b-device -P "$P" -t "$T" -q 1 -C 1 >/tmp/phase51b-allowed.txt & s=$!
  sleep 1
  mosquitto_pub -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u phase51b-device -P "$P" -t "$T" -q 1 -m phase51-ok
  wait "$s"
  grep -qx phase51-ok /tmp/phase51b-allowed.txt
'

"${compose[@]}" exec -T -e PP="$client_password" -e AP="$auditor_password" -e T="$forbidden" agrios-mosquitto sh -c '
  set +e
  timeout 5 mosquitto_sub -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u phase51b-auditor -P "$AP" -t "$T" -q 1 -C 1 >/tmp/phase51b-forbidden.txt & s=$!
  sleep 1
  mosquitto_pub -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u phase51b-device -P "$PP" -t "$T" -q 1 -m must-not-arrive
  wait "$s"; status=$?
  set -e
  test "$status" -ne 0
  test ! -s /tmp/phase51b-forbidden.txt
'

echo 'PASS MQTT TLS authentication, publish/subscribe, and ACL delivery denial'
