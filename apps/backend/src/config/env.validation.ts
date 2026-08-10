type Env = Record<string, string | undefined>;

const deviceModes = new Set(['MOCK', 'THINGSBOARD_CLOUD', 'MQTT_DIRECT', 'EDGE_HTTP', 'PLC_GATEWAY', 'BLUETOOTH_LOCAL', 'MQTT', 'THINGSBOARD']);
const queueDrivers = new Set(['memory', 'bullmq']);

export function validateEnv(config: Env) {
  const nodeEnv = config.NODE_ENV ?? 'development';
  const errors: string[] = [];

  if (!config.DATABASE_URL) {
    errors.push('DATABASE_URL is required');
  }

  if (nodeEnv === 'production' && !config.JWT_SECRET) {
    errors.push('JWT_SECRET is required in production');
  }
  if (nodeEnv === 'production' && !config.JWT_REFRESH_SECRET) {
    errors.push('JWT_REFRESH_SECRET is required in production');
  }
  if (nodeEnv === 'production' && config.JWT_REFRESH_SECRET === config.JWT_SECRET) {
    errors.push('JWT_REFRESH_SECRET must differ from JWT_SECRET in production');
  }
  if (nodeEnv === 'production' && (!config.DEVICE_ACK_HMAC_SECRET || config.DEVICE_ACK_HMAC_SECRET.length < 32)) {
    errors.push('DEVICE_ACK_HMAC_SECRET must contain at least 32 characters in production');
  }

  if (config.DEVICE_CONTROL_MODE && !deviceModes.has(config.DEVICE_CONTROL_MODE)) {
    errors.push('DEVICE_CONTROL_MODE must be one of MOCK, THINGSBOARD_CLOUD, MQTT_DIRECT, EDGE_HTTP, PLC_GATEWAY, BLUETOOTH_LOCAL');
  }

  const actionQueueDriver = config.ACTION_QUEUE_DRIVER ?? (config.REDIS_URL ? 'bullmq' : 'memory');
  if (actionQueueDriver && !queueDrivers.has(actionQueueDriver)) {
    errors.push('ACTION_QUEUE_DRIVER must be memory or bullmq');
  }

  const uploadMaxFileMb = Number(config.UPLOAD_MAX_FILE_MB ?? 20);
  if (!Number.isFinite(uploadMaxFileMb) || uploadMaxFileMb <= 0) {
    errors.push('UPLOAD_MAX_FILE_MB must be a positive number');
  }

  const retryCount = Number(config.ACTION_QUEUE_MAX_RETRIES ?? 3);
  if (!Number.isInteger(retryCount) || retryCount < 0) {
    errors.push('ACTION_QUEUE_MAX_RETRIES must be a non-negative integer');
  }

  const valveCommandTimeoutMs = Number(config.VALVE_COMMAND_TIMEOUT_MS ?? 10000);
  if (!Number.isInteger(valveCommandTimeoutMs) || valveCommandTimeoutMs < 1000) {
    errors.push('VALVE_COMMAND_TIMEOUT_MS must be an integer >= 1000');
  }

  const valveMaxOpenSeconds = Number(config.VALVE_MAX_OPEN_SECONDS ?? 30);
  if (!Number.isInteger(valveMaxOpenSeconds) || valveMaxOpenSeconds < 1 || valveMaxOpenSeconds > 30) {
    errors.push('VALVE_MAX_OPEN_SECONDS must be an integer between 1 and 30');
  }

  if (errors.length) {
    throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    JWT_EXPIRES_IN: config.JWT_EXPIRES_IN ?? '7d',
    JWT_REFRESH_EXPIRES_IN: config.JWT_REFRESH_EXPIRES_IN ?? '7d',
    DEVICE_ACK_HMAC_TOLERANCE_SECONDS: config.DEVICE_ACK_HMAC_TOLERANCE_SECONDS ?? '300',
    ENABLE_AUTO_EXECUTION: config.ENABLE_AUTO_EXECUTION ?? 'false',
    DEVICE_CONTROL_MODE: config.DEVICE_CONTROL_MODE ?? 'MOCK',
    DEVICE_CONTROL_DRY_RUN: config.DEVICE_CONTROL_DRY_RUN ?? 'true',
    VALVE_COMMAND_TIMEOUT_MS: String(valveCommandTimeoutMs),
    VALVE_MAX_OPEN_SECONDS: String(valveMaxOpenSeconds),
    VALVE_REQUIRE_FEEDBACK: config.VALVE_REQUIRE_FEEDBACK ?? 'true',
    VALVE_ALLOW_REAL_CONTROL: config.VALVE_ALLOW_REAL_CONTROL ?? 'false',
    PLC_TRANSPORT: config.PLC_TRANSPORT ?? 'FAKE',
    PLC_REAL_WRITE_ENABLED: config.PLC_REAL_WRITE_ENABLED ?? 'false',
    PLC_MODBUS_HOST: config.PLC_MODBUS_HOST ?? '127.0.0.1',
    PLC_MODBUS_PORT: config.PLC_MODBUS_PORT ?? '502',
    PLC_MODBUS_UNIT_ID: config.PLC_MODBUS_UNIT_ID ?? '1',
    PLC_CONNECT_TIMEOUT_MS: config.PLC_CONNECT_TIMEOUT_MS ?? '2000',
    PLC_COMMAND_TIMEOUT_MS: config.PLC_COMMAND_TIMEOUT_MS ?? '2000',
    PLC_COMMAND_RETRY: config.PLC_COMMAND_RETRY ?? '0',
    UPLOAD_MAX_FILE_MB: String(uploadMaxFileMb),
    CORS_ORIGINS: config.CORS_ORIGINS ?? 'http://localhost:5174,http://localhost:5173',
    ACTION_QUEUE_DRIVER: actionQueueDriver,
    ACTION_QUEUE_MAX_RETRIES: String(retryCount)
  };
}
