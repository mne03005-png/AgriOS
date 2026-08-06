export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  enableAutoExecution: (process.env.ENABLE_AUTO_EXECUTION ?? 'false').toLowerCase() === 'true',
  deviceControlMode: process.env.DEVICE_CONTROL_MODE ?? 'MOCK',
  thingsboardBaseUrl: process.env.THINGSBOARD_BASE_URL ?? process.env.THINGSBOARD_URL,
  thingsboardToken: process.env.THINGSBOARD_TOKEN,
  mqttBrokerUrl: process.env.MQTT_BROKER_URL,
  mqttUsername: process.env.MQTT_USERNAME,
  mqttPassword: process.env.MQTT_PASSWORD,
  edgeControllerBaseUrl: process.env.EDGE_CONTROLLER_BASE_URL,
  edgeControllerToken: process.env.EDGE_CONTROLLER_TOKEN,
  plcGatewayBaseUrl: process.env.PLC_GATEWAY_BASE_URL,
  plcGatewayToken: process.env.PLC_GATEWAY_TOKEN,
  enableBluetoothLocal: (process.env.ENABLE_BLUETOOTH_LOCAL ?? 'false').toLowerCase() === 'true',
  uploadMaxFileMb: Number(process.env.UPLOAD_MAX_FILE_MB ?? 20),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5174,http://localhost:5173')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  actionQueueDriver: process.env.ACTION_QUEUE_DRIVER ?? (process.env.REDIS_URL ? 'bullmq' : 'memory'),
  actionQueueMaxRetries: Number(process.env.ACTION_QUEUE_MAX_RETRIES ?? 3)
});
