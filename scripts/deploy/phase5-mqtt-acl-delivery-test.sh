#!/usr/bin/env bash
set -Eeuo pipefail

cd "${AGRIOS_GRAY_DIR:-/home/ubuntu/agrios-docker-gray}"
compose=(docker compose --env-file .env.gray -f docker-compose.production.yml -f docker-compose.gray.yml)
forbidden_topic='agrios/phase5-tenant-b/private'
publisher='phase5-device'
auditor='phase5-acl-auditor'
auditor_role='phase5-acl-auditor-role'
publisher_password="$(openssl rand -hex 24)"
auditor_password="$(openssl rand -hex 24)"

admin_ctrl() {
  # Variables expand inside the container.
  # shellcheck disable=SC2016
  "${compose[@]}" exec -T agrios-mosquitto sh -c \
    'mosquitto_ctrl -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" dynsec "$@"' \
    phase5-acl "$@"
}

admin_ctrl listClients | grep -qx "$publisher"
if admin_ctrl listClients | grep -qx "$auditor"; then
  echo "refusing existing MQTT auditor: $auditor" >&2
  exit 1
fi

admin_ctrl setClientPassword "$publisher" "$publisher_password"
admin_ctrl createClient "$auditor" -p "$auditor_password"
admin_ctrl createRole "$auditor_role"
admin_ctrl addRoleACL "$auditor_role" publishClientReceive "$forbidden_topic" allow
admin_ctrl addRoleACL "$auditor_role" subscribeLiteral "$forbidden_topic" allow
admin_ctrl addRoleACL "$auditor_role" unsubscribeLiteral "$forbidden_topic" allow
admin_ctrl addClientRole "$auditor" "$auditor_role"

# Variables expand inside the container.
# shellcheck disable=SC2016
"${compose[@]}" exec -T \
  -e PHASE5_PUBLISHER_PASSWORD="$publisher_password" \
  -e PHASE5_AUDITOR_PASSWORD="$auditor_password" \
  -e PHASE5_FORBIDDEN_TOPIC="$forbidden_topic" \
  agrios-mosquitto sh -c '
    test ! -e /tmp/phase5-mqtt-forbidden-delivery.txt
    set +e
    timeout 6 mosquitto_sub -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u phase5-acl-auditor -P "$PHASE5_AUDITOR_PASSWORD" -t "$PHASE5_FORBIDDEN_TOPIC" -q 1 -C 1 > /tmp/phase5-mqtt-forbidden-delivery.txt &
    subscriber=$!
    sleep 1
    mosquitto_pub -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u phase5-device -P "$PHASE5_PUBLISHER_PASSWORD" -t "$PHASE5_FORBIDDEN_TOPIC" -q 1 -m must-not-arrive
    wait "$subscriber"
    subscriber_status=$?
    set -e
    test "$subscriber_status" -eq 124
    test ! -s /tmp/phase5-mqtt-forbidden-delivery.txt
  '

printf 'MQTT_ACL_DENY_DELIVERY=passed publisher=%s forbidden_topic=%s\n' "$publisher" "$forbidden_topic"
admin_ctrl getDefaultACLAccess
