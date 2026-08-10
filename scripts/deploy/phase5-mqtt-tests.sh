#!/usr/bin/env bash
set -Eeuo pipefail

cd "${AGRIOS_GRAY_DIR:-/home/ubuntu/agrios-docker-gray}"
set -a
# shellcheck disable=SC1091
source .env.gray
set +a
compose=(docker compose --env-file .env.gray -f docker-compose.production.yml -f docker-compose.gray.yml)
topic='agrios/phase5-tenant-a/phase5-farm-a/devices/phase5-device/telemetry'
forbidden_topic='agrios/phase5-tenant-b/private'
client='phase5-device'
role='phase5-device-role'
client_password="$(openssl rand -hex 24)"

admin_ctrl() {
  # Variables expand inside the container.
  # shellcheck disable=SC2016
  "${compose[@]}" exec -T agrios-mosquitto sh -c \
    'mosquitto_ctrl -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" dynsec "$@"' \
    phase5-mqtt "$@"
}

if admin_ctrl listClients | grep -qx "$client"; then
  echo "refusing existing MQTT test client: $client" >&2
  exit 1
fi

admin_ctrl createClient "$client" -p "$client_password"
admin_ctrl createRole "$role"
admin_ctrl addRoleACL "$role" publishClientSend "$topic" allow
admin_ctrl addRoleACL "$role" publishClientReceive "$topic" allow
admin_ctrl addRoleACL "$role" subscribeLiteral "$topic" allow
admin_ctrl addRoleACL "$role" unsubscribeLiteral "$topic" allow
admin_ctrl addClientRole "$client" "$role"

output='/tmp/phase5-mqtt-message.txt'
# Variables expand inside the container.
# shellcheck disable=SC2016
"${compose[@]}" exec -T \
  -e PHASE5_MQTT_PASSWORD="$client_password" \
  -e PHASE5_MQTT_TOPIC="$topic" \
  agrios-mosquitto sh -c \
  'test ! -e /tmp/phase5-mqtt-message.txt; timeout 12 mosquitto_sub -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u phase5-device -P "$PHASE5_MQTT_PASSWORD" -t "$PHASE5_MQTT_TOPIC" -q 1 -C 1 > /tmp/phase5-mqtt-message.txt & subscriber=$!; sleep 1; mosquitto_pub -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u phase5-device -P "$PHASE5_MQTT_PASSWORD" -t "$PHASE5_MQTT_TOPIC" -q 1 -m phase5-ok; wait "$subscriber"; grep -qx phase5-ok /tmp/phase5-mqtt-message.txt'
printf 'MQTT_TLS_AUTH_PUBLISH_SUBSCRIBE=passed topic=%s output=%s\n' "$topic" "$output"

set +e
# Variables expand inside the container.
# shellcheck disable=SC2016
"${compose[@]}" exec -T \
  -e PHASE5_MQTT_PASSWORD="$client_password" \
  -e PHASE5_MQTT_FORBIDDEN_TOPIC="$forbidden_topic" \
  agrios-mosquitto sh -c \
  'mosquitto_pub -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u phase5-device -P "$PHASE5_MQTT_PASSWORD" -t "$PHASE5_MQTT_FORBIDDEN_TOPIC" -q 1 -m forbidden' \
  >/dev/null 2>&1
denied_status=$?
set -e
if (( denied_status == 0 )); then
  echo 'MQTT_ACL_DENY=failed unauthorized publish returned success' >&2
  exit 1
fi
printf 'MQTT_ACL_DENY=passed exit=%s topic=%s\n' "$denied_status" "$forbidden_topic"

admin_ctrl getClient "$client" >/dev/null
printf 'MQTT_DYNAMIC_SECURITY_CLIENT=passed client=%s role=%s\n' "$client" "$role"
