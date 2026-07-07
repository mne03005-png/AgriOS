import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function assertContains(file, source, expected) {
  if (!source.includes(expected)) throw new Error(`${file} missing: ${expected}`);
}

function assertNotContains(file, source, unexpected) {
  if (source.includes(unexpected)) throw new Error(`${file} must not contain: ${unexpected}`);
}

const jwtGuard = read('src/modules/auth/jwt-auth.guard.ts');
assertContains('src/modules/auth/jwt-auth.guard.ts', jwtGuard, 'IS_PUBLIC_KEY');
assertContains('src/modules/auth/jwt-auth.guard.ts', jwtGuard, 'this.jwtService.verify(token)');
assertContains('src/modules/auth/jwt-auth.guard.ts', jwtGuard, 'this.requestContext.setAuthContext');
assertNotContains('src/modules/auth/jwt-auth.guard.ts', jwtGuard, "Buffer.from(token.split('.')[1]");

const authModule = read('src/modules/auth/auth.module.ts');
assertContains('src/modules/auth/auth.module.ts', authModule, 'APP_GUARD');

const main = read('src/main.ts');
assertNotContains('src/main.ts', main, "Buffer.from(token.split('.')[1]");
assertNotContains('src/main.ts', main, "headers['x-tenant-id']");
assertContains('src/main.ts', main, '.addBearerAuth()');

const authController = read('src/modules/auth/auth.controller.ts');
assertContains('src/modules/auth/auth.controller.ts', authController, '@Public()');
assertContains('src/modules/auth/auth.controller.ts', authController, "@Post('login')");
assertContains('src/modules/auth/auth.controller.ts', authController, "@Post('register')");

const healthController = read('src/modules/health/health.controller.ts');
assertContains('src/modules/health/health.controller.ts', healthController, '@Public()');

const tenantGuard = read('src/common/tenant/tenant.guard.ts');
assertContains('src/common/tenant/tenant.guard.ts', tenantGuard, 'Tenant mismatch');
assertContains('src/common/tenant/tenant.guard.ts', tenantGuard, 'Tenant context is required');
assertContains('src/common/tenant/tenant.guard.ts', tenantGuard, 'requestContext.setAuthContext');

const userService = read('src/modules/user/user.service.ts');
for (const forbidden of ['passwordHash: true', 'tokenVersion: true', 'failedLoginCount: true', 'lockedUntil: true', 'passwordChangedAt: true']) {
  assertNotContains('src/modules/user/user.service.ts', userService, forbidden);
}
assertContains('src/modules/user/user.service.ts', userService, 'safeUserSelect');
assertContains('src/modules/user/user.service.ts', userService, 'assertCanManageUsers');

const authService = read('src/modules/auth/auth.service.ts');
assertContains('src/modules/auth/auth.service.ts', authService, 'failedLoginCount: _failedLoginCount');
assertContains('src/modules/auth/auth.service.ts', authService, 'lockedUntil: _lockedUntil');
assertContains('src/modules/auth/auth.service.ts', authService, 'passwordChangedAt: _passwordChangedAt');

const deviceService = read('src/modules/device/device.service.ts');
assertContains('src/modules/device/device.service.ts', deviceService, 'GoneException');
assertContains('src/modules/device/device.service.ts', deviceService, 'Legacy device command endpoint is disabled');
assertNotContains('src/modules/device/device.service.ts', deviceService, 'publishCommand');
assertNotContains('src/modules/device/device.service.ts', deviceService, 'thingsboardAccessToken: true');

const mqttController = read('src/modules/mqtt/mqtt.controller.ts');
assertContains('src/modules/mqtt/mqtt.controller.ts', mqttController, 'GoneException');
assertNotContains('src/modules/mqtt/mqtt.controller.ts', mqttController, 'mqttService.publishCommand');

const iotIntegrationService = read('src/modules/iot/integration/iot-integration.service.ts');
assertContains('src/modules/iot/integration/iot-integration.service.ts', iotIntegrationService, 'READ_ONLY_MODE');
assertNotContains('src/modules/iot/integration/iot-integration.service.ts', iotIntegrationService, 'publishCommand');

const sensorRecordService = read('src/modules/sensor-record/sensor-record.service.ts');
assertContains('src/modules/sensor-record/sensor-record.service.ts', sensorRecordService, 'safeSensorRecordSelect');
assertNotContains('src/modules/sensor-record/sensor-record.service.ts', sensorRecordService, 'rawPayload: true');

for (const file of [
  'src/modules/device/device.service.ts',
  'src/modules/sensor-record/sensor-record.service.ts',
  'src/modules/crop-season/crop-season.service.ts',
  'src/modules/work-log/work-log.service.ts',
  'src/modules/farm-input/farm-input.service.ts',
  'src/modules/irrigation/irrigation.service.ts',
  'src/modules/cost/cost.service.ts',
  'src/modules/service-provider/service-provider.service.ts'
]) {
  assertContains(file, read(file), 'tenant');
}

async function httpChecks(baseUrl) {
  const paths = [
    ['GET', '/users'],
    ['GET', '/devices'],
    ['GET', '/sensor-records'],
    ['POST', '/users'],
    ['PATCH', '/users/nonexistent'],
    ['DELETE', '/users/nonexistent'],
    ['POST', '/devices/nonexistent/command']
  ];
  for (const [method, path] of paths) {
    const response = await fetch(`${baseUrl}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });
    if (response.status !== 401) throw new Error(`${method} ${path} expected 401, got ${response.status}`);
  }
  const live = await fetch(`${baseUrl}/health/live`);
  if (live.status !== 200) throw new Error(`GET /health/live expected 200, got ${live.status}`);
}

if (process.env.AGRIOS_SECURITY_BASE_URL) {
  await httpChecks(process.env.AGRIOS_SECURITY_BASE_URL.replace(/\/$/, ''));
  console.log('Stage 5 security static and HTTP checks passed.');
} else {
  console.log('Stage 5 security static checks passed. Set AGRIOS_SECURITY_BASE_URL to run HTTP checks.');
}
