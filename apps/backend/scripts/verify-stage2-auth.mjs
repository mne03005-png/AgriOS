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

const schema = read('prisma/schema.prisma');
assertContains('prisma/schema.prisma', schema, 'tokenVersion Int     @default(0)');
assertContains('prisma/schema.prisma', schema, 'passwordChangedAt DateTime?');
assertContains('prisma/schema.prisma', schema, 'failedLoginCount Int @default(0)');
assertContains('prisma/schema.prisma', schema, 'lockedUntil DateTime?');

const authService = read('src/modules/auth/auth.service.ts');
assertContains('src/modules/auth/auth.service.ts', authService, 'async changePassword');
assertContains('src/modules/auth/auth.service.ts', authService, 'tokenVersion: { increment: 1 }');
assertContains('src/modules/auth/auth.service.ts', authService, 'authFailureMessage');
assertContains('src/modules/auth/auth.service.ts', authService, 'failedLoginCount');
assertContains('src/modules/auth/auth.service.ts', authService, 'lockedUntil');
assertContains('src/modules/auth/auth.service.ts', authService, "eventType: 'auth.logout'");

const jwtGuard = read('src/modules/auth/jwt-auth.guard.ts');
assertContains('src/modules/auth/jwt-auth.guard.ts', jwtGuard, 'this.prisma.user.findUnique');
assertContains('src/modules/auth/jwt-auth.guard.ts', jwtGuard, "user.status === 'DISABLED'");
assertContains('src/modules/auth/jwt-auth.guard.ts', jwtGuard, 'user.tokenVersion !== (payload.tokenVersion ?? 0)');

const authController = read('src/modules/auth/auth.controller.ts');
assertContains('src/modules/auth/auth.controller.ts', authController, "@Post('change-password')");
assertContains('src/modules/auth/auth.controller.ts', authController, "@Post('logout')");

const tenantGuard = read('src/common/tenant/tenant.guard.ts');
assertContains('src/common/tenant/tenant.guard.ts', tenantGuard, 'Farm mismatch');
assertContains('src/common/tenant/tenant.guard.ts', tenantGuard, "role === 'PLATFORM_ADMIN' || role === 'SUPER_ADMIN'");

const mobileController = read('src/modules/mobile/mobile.controller.ts');
assertContains('src/modules/mobile/mobile.controller.ts', mobileController, '@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)');
assertContains('src/modules/mobile/mobile.controller.ts', mobileController, '@Permissions(PERMISSIONS.MOBILE_READ)');
assertContains('src/modules/mobile/mobile.controller.ts', mobileController, '@Permissions(PERMISSIONS.IRRIGATION_EXECUTE)');

const mobileService = read('src/modules/mobile/mobile.service.ts');
assertContains('src/modules/mobile/mobile.service.ts', mobileService, 'resolveFarmId');
assertContains('src/modules/mobile/mobile.service.ts', mobileService, 'Farm mismatch');
assertContains('src/modules/mobile/mobile.service.ts', mobileService, 'Device is outside current tenant');

const farmController = read('src/modules/farm/farm.controller.ts');
assertContains('src/modules/farm/farm.controller.ts', farmController, '@UseGuards(JwtAuthGuard, TenantGuard)');
const farmService = read('src/modules/farm/farm.service.ts');
assertContains('src/modules/farm/farm.service.ts', farmService, 'scopeWhere');
assertContains('src/modules/farm/farm.service.ts', farmService, 'assertInScope');

const fieldController = read('src/modules/field/field.controller.ts');
assertContains('src/modules/field/field.controller.ts', fieldController, '@UseGuards(JwtAuthGuard, TenantGuard)');
const fieldService = read('src/modules/field/field.service.ts');
assertContains('src/modules/field/field.service.ts', fieldService, 'assertCanAccessField');
assertContains('src/modules/field/field.service.ts', fieldService, 'assertCanAccessFarmRecord');

const mobileHttp = read('../mobile/src/api/http.ts');
assertContains('../mobile/src/api/http.ts', mobileHttp, 'import.meta.env.DEV && env.VITE_AUTH_TOKEN');
assertContains('../mobile/src/api/http.ts', mobileHttp, 'authStore.clear()');
assertNotContains('../mobile/src/router/index.ts', read('../mobile/src/router/index.ts'), 'VITE_AUTH_TOKEN');
assertContains('../mobile/src/router/index.ts', read('../mobile/src/router/index.ts'), 'ChangePasswordPage');

console.log('Stage 2 auth and tenant isolation checks passed.');
