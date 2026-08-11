import 'reflect-metadata';
import assert = require('node:assert/strict');
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { RequestContextService } from '../src/common/request-context.service';
import { ValveControlService } from '../src/modules/device-control/valve-control.service';

type Test = { name: string; run: () => void | Promise<void> }; const tests: Test[] = []; const test = (name: string, run: Test['run']) => tests.push({ name, run });
function filter(exception: unknown, requestId = 'request-r1c-0001') { let body: any; let status = 0; const host: any = { switchToHttp: () => ({ getResponse: () => ({ status: (value: number) => ({ json: (payload: any) => { status = value; body = payload; } }) }), getRequest: () => ({ url: '/api/v1/mobile/control/valve', requestId }) }) }; new HttpExceptionFilter().catch(exception, host); return { body, status }; }

test('1 structured ForbiddenException preserves errorCode', () => { const r = filter(new ForbiddenException({ errorCode: 'EMERGENCY_STOP_ACTIVE', reasons: ['EMERGENCY_STOP_ACTIVE'] })); assert.equal(r.body.errorCode, 'EMERGENCY_STOP_ACTIVE'); });
test('2 structured ForbiddenException preserves reasons', () => { const r = filter(new ForbiddenException({ errorCode: 'EMERGENCY_STOP_ACTIVE', reasons: ['EMERGENCY_STOP_ACTIVE'] })); assert.deepEqual(r.body.reasons, ['EMERGENCY_STOP_ACTIVE']); });
test('3 requestId is preserved', () => { assert.equal(filter(new ForbiddenException('no'), 'safe-request-123').body.requestId, 'safe-request-123'); });
test('4 status remains 403', () => { const r = filter(new ForbiddenException({ errorCode: 'EMERGENCY_STOP_ACTIVE' })); assert.equal(r.status, 403); assert.equal(r.body.statusCode, 403); });
test('5 string ForbiddenException has safe fallback', () => { const r = filter(new ForbiddenException('Not allowed')); assert.equal(r.body.errorCode, 'HTTP_403'); assert.equal(r.body.message, 'Not allowed'); });
test('6 validation message array remains useful', () => { const r = filter(new BadRequestException({ message: ['deviceId should not be empty', 'command is invalid'], error: 'Bad Request', statusCode: 400 })); assert.equal(r.body.message, 'deviceId should not be empty; command is invalid'); assert.deepEqual(r.body.reasons, ['deviceId should not be empty', 'command is invalid']); });
test('7 validation errors use VALIDATION_ERROR', () => { const r = filter(new BadRequestException({ message: ['invalid'], statusCode: 400 })); assert.equal(r.body.errorCode, 'VALIDATION_ERROR'); });
test('8 actionPlanId allowlist is preserved', () => { assert.equal(filter(new ForbiddenException({ errorCode: 'SAFETY_BLOCKED', actionPlanId: 'plan-a' })).body.actionPlanId, 'plan-a'); });
test('9 commandId allowlist is preserved', () => { assert.equal(filter(new ForbiddenException({ errorCode: 'SAFETY_BLOCKED', commandId: 'command-a' })).body.commandId, 'command-a'); });
test('10 P2002 mapping remains intact', () => { const r = filter({ code: 'P2002', message: 'secret db detail' }); assert.equal(r.body.errorCode, 'P2002'); assert.equal(r.status, 409); assert.ok(!r.body.message.includes('secret')); });
test('11 P2025 mapping remains intact', () => { const r = filter({ code: 'P2025', message: 'secret db detail' }); assert.equal(r.body.errorCode, 'P2025'); assert.equal(r.status, 404); });
test('12 P2003 mapping remains intact', () => { const r = filter({ code: 'P2003', message: 'secret db detail' }); assert.equal(r.body.errorCode, 'P2003'); assert.equal(r.status, 400); });
test('13 unknown production error exposes no stack or message', () => { const error = new Error('DATABASE_URL=mysql://secret'); const r = filter(error); assert.equal(r.body.stack, undefined); assert.ok(!JSON.stringify(r.body).includes('DATABASE_URL')); });
test('14 generic Error becomes INTERNAL_ERROR', () => { const r = filter(new Error('internal secret')); assert.equal(r.body.errorCode, 'INTERNAL_ERROR'); assert.equal(r.body.message, 'Internal server error'); });
test('15 path and timestamp remain present', () => { const r = filter(new Error('x')); assert.equal(r.body.path, '/api/v1/mobile/control/valve'); assert.ok(Number.isFinite(Date.parse(r.body.timestamp))); });

function valveFixture(input: { emergency?: boolean; dryRun?: string; allowReal?: string }) { const ctx = new RequestContextService(); const device = { id: 'valve-a', code: 'V1', tenantId: 'tenant-a', fieldId: 'field-a', type: 'VALVE', online: true, field: { id: 'field-a', farmId: 'farm-a' } }; const prisma: any = { device: { findFirst: async () => device }, deviceCommand: { findFirst: async () => null }, safetyPolicy: { findFirst: async () => input.emergency ? { id: 'estop' } : null } }; const config = { get: (key: string) => ({ DEVICE_CONTROL_DRY_RUN: input.dryRun ?? 'true', VALVE_ALLOW_REAL_CONTROL: input.allowReal ?? 'false', VALVE_REQUIRE_FEEDBACK: 'true' } as any)[key] } as ConfigService; const service = new ValveControlService(prisma, config, ctx, { record: async () => undefined } as any, { publish: () => undefined } as any); return { ctx, service }; }
const inTenant = <T>(ctx: RequestContextService, fn: () => Promise<T>) => new Promise<T>((resolve, reject) => ctx.run({ tenantId: 'tenant-a', role: 'FARM_MANAGER' }, () => fn().then(resolve, reject)));
async function domainResponse(options: any) { const f = valveFixture(options); try { await inTenant(f.ctx, () => f.service.requestOpenValve('valve-a', { dryRun: options.dryRun !== 'false' })); throw new Error('expected rejection'); } catch (error) { return filter(error); } }
test('16 real Valve E-stop rejection preserves EMERGENCY_STOP_ACTIVE', async () => { assert.equal((await domainResponse({ emergency: true })).body.errorCode, 'EMERGENCY_STOP_ACTIVE'); });
test('17 real-disabled Valve rejection preserves REAL_CONTROL_DISABLED', async () => { assert.equal((await domainResponse({ dryRun: 'false', allowReal: 'false' })).body.errorCode, 'REAL_CONTROL_DISABLED'); });
test('18 approval-required Valve rejection preserves reasons', async () => { const r = await domainResponse({ dryRun: 'false', allowReal: 'true' }); assert.equal(r.body.errorCode, 'APPROVAL_REQUIRED'); assert.deepEqual(r.body.reasons, ['APPROVAL_REQUIRED']); });
test('19 safety/interlock structured response remains rejected', () => { const r = filter(new ForbiddenException({ errorCode: 'SAFETY_BLOCKED', reasons: ['NO_WATER'], actionPlanId: 'plan-a' })); assert.equal(r.status, 403); assert.equal(r.body.errorCode, 'SAFETY_BLOCKED'); assert.deepEqual(r.body.reasons, ['NO_WATER']); });
test('20 arbitrary secret and stack properties are not exposed', () => { const r = filter(new ForbiddenException({ errorCode: 'SAFETY_BLOCKED', password: 'secret', jwt: 'token', authorization: 'Bearer token', stack: 'stack detail' })); const serialized = JSON.stringify(r.body); assert.ok(!serialized.includes('secret')); assert.ok(!serialized.includes('Bearer')); assert.equal(r.body.stack, undefined); });

async function main() { let passed = 0; for (const item of tests) { try { await item.run(); passed++; console.log(`PASS ${item.name}`); } catch (error) { console.error(`FAIL ${item.name}`, error); process.exitCode = 1; } } console.log(`R1-C BACKEND STRUCTURED ERRORS: ${passed}/${tests.length} PASS`); if (passed !== tests.length) process.exitCode = 1; }
void main();
