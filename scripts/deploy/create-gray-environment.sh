#!/usr/bin/env bash
set -Eeuo pipefail
set -o noclobber

TARGET_DIR="${1:-/home/ubuntu/agrios-docker-gray}"
ENV_FILE="$TARGET_DIR/.env.gray"
SECRETS_DIR="$TARGET_DIR/secrets/mosquitto"
TLS_DIR="$SECRETS_DIR/tls"

[[ -d "$TARGET_DIR" ]] || { echo "target directory does not exist: $TARGET_DIR" >&2; exit 1; }
for path in "$ENV_FILE" "$SECRETS_DIR/dynamic-security.json" "$TLS_DIR/ca.key" "$TLS_DIR/ca.pem" "$TLS_DIR/privkey.pem" "$TLS_DIR/cert.pem" "$TLS_DIR/fullchain.pem"; do
  [[ ! -e "$path" ]] || { echo "refusing to overwrite existing path: $path" >&2; exit 1; }
done

umask 077
mkdir -p "$TLS_DIR"

mysql_password="$(openssl rand -hex 24)"
mysql_root_password="$(openssl rand -hex 32)"
jwt_secret="$(openssl rand -hex 48)"
mqtt_password="$(openssl rand -hex 24)"

openssl req -x509 -newkey rsa:3072 -nodes -sha256 -days 30 \
  -keyout "$TLS_DIR/ca.key" \
  -out "$TLS_DIR/ca.pem" \
  -subj '/CN=AgriOS Gray Internal CA'
openssl req -newkey rsa:2048 -nodes -sha256 \
  -keyout "$TLS_DIR/privkey.pem" \
  -out "$TLS_DIR/server.csr" \
  -subj '/CN=agrios-mqtt.xyzwtt.com'
openssl x509 -req -sha256 -days 30 \
  -in "$TLS_DIR/server.csr" \
  -CA "$TLS_DIR/ca.pem" \
  -CAkey "$TLS_DIR/ca.key" \
  -CAcreateserial \
  -out "$TLS_DIR/cert.pem" \
  -extfile <(printf 'subjectAltName=DNS:agrios-mqtt.xyzwtt.com\nextendedKeyUsage=serverAuth\n')
(cat "$TLS_DIR/cert.pem" "$TLS_DIR/ca.pem") >"$TLS_DIR/fullchain.pem"

cat >"$ENV_FILE" <<EOF
COMPOSE_PROJECT_NAME=agrios-gray
AGRIOS_IMAGE_TAG=d382ce9-gray1
AGRIOS_API_HOST_PORT=3200
AGRIOS_WEB_HOST_PORT=3201
MYSQL_DATABASE=agrios
MYSQL_USER=agrios
MYSQL_PASSWORD=$mysql_password
MYSQL_ROOT_PASSWORD=$mysql_root_password
DATABASE_URL=mysql://agrios:$mysql_password@agrios-mysql:3306/agrios
REDIS_URL=redis://agrios-redis:6379
JWT_SECRET=$jwt_secret
JWT_EXPIRES_IN=15m
CORS_ORIGINS=https://agrios.xyzwtt.com
VITE_API_BASE_URL=https://agrios-api.xyzwtt.com/api/v1
MQTT_CLIENT_ID=agrios-api-gray
MQTT_USERNAME=admin
MQTT_PASSWORD=$mqtt_password
MQTT_TLS_BIND_ADDRESS=127.0.0.1
MQTT_TLS_PORT=38883
DEVICE_OFFLINE_AFTER_SECONDS=300
DEVICE_CONTROL_MODE=MOCK
DEVICE_CONTROL_DRY_RUN=true
VALVE_ALLOW_REAL_CONTROL=false
VALVE_REQUIRE_FEEDBACK=true
ENABLE_AUTO_EXECUTION=false
AGRIOS_SECRETS_DIR=$TARGET_DIR/secrets
AGRIOS_TLS_DIR=$TLS_DIR
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6
OPENAI_INPUT_COST_PER_MILLION=0
OPENAI_OUTPUT_COST_PER_MILLION=0
SPEECH_SERVICE_HOST=host.docker.internal
SPEECH_SERVICE_PORT=8000
EOF

chmod 600 "$ENV_FILE" "$TLS_DIR"/*
printf 'created=%s\ncreated=%s\n' "$ENV_FILE" "$TLS_DIR"
