import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../src/', import.meta.url);
const roles = readFileSync(new URL('common/permissions/canonical-role.ts', root), 'utf8');
const matrix = readFileSync(new URL('common/permissions/permission-matrix.ts', root), 'utf8');
const tenant = readFileSync(new URL('common/tenant/tenant.guard.ts', root), 'utf8');
const auth = readFileSync(new URL('modules/auth/auth.service.ts', root), 'utf8');
const control = readFileSync(new URL('modules/device-control/device-control.service.ts', root), 'utf8');

for (const role of ['FARMER', 'MANAGER', 'INSTALLER', 'ENGINEER', 'SUPER_ADMIN']) assert.match(roles, new RegExp(`'${role}'`));
for (const legacy of ['PLATFORM_ADMIN', 'TENANT_ADMIN', 'FARM_MANAGER', 'MAINTAINER']) assert.match(roles, new RegExp(`${legacy}:`));
assert.match(tenant, /x-platform-context/);
assert.match(tenant, /platform_context_required/);
assert.match(auth, /tokenVersion: \{ increment: 1 \}/);
assert.match(auth, /status === 'DISABLED'/);
assert.match(control, /mode === 'MOCK' \|\| dryRun \|\| !allowRealValve \|\| !autoExecution/);
assert.doesNotMatch(matrix, /item !== PERMISSIONS\.BILLING_MANAGE \|\| true/);
console.log('Phase A backend security contracts: PASS');
