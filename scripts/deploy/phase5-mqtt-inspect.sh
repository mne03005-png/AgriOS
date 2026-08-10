#!/usr/bin/env bash
set -Eeuo pipefail
cd "${AGRIOS_GRAY_DIR:-/home/ubuntu/agrios-docker-gray}"
compose=(docker compose --env-file .env.gray -f docker-compose.production.yml -f docker-compose.gray.yml)
# Variables expand inside the container.
# shellcheck disable=SC2016
"${compose[@]}" exec -T agrios-mosquitto sh -c '
mosquitto_ctrl -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" dynsec listClients
mosquitto_ctrl -h agrios-mqtt.xyzwtt.com -p 8883 --cafile /mosquitto/secrets/tls/fullchain.pem -u "$MQTT_USERNAME" -P "$MQTT_PASSWORD" dynsec listRoles
'
