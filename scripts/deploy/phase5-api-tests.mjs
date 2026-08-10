const origin = process.env.PHASE5_API_ORIGIN ?? 'http://127.0.0.1:3000';
const base = `${origin}/api/v1`;
const password = process.env.PHASE5_PASSWORD;
const results = [];

function record(name, passed, detail, severity = 'FAIL') {
  results.push({ name, status: passed ? 'PASS' : severity, detail });
}

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, headers: response.headers, body, data: body?.data ?? body };
}

async function login(email) {
  return request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
}

const live = await request('/health/live');
record('health/live', live.status === 200 && live.data?.ok === true, `http=${live.status} ok=${live.data?.ok}`);
const ready = await request('/health/ready');
record('health/ready', ready.status === 200 && ready.data?.ok === true, `http=${ready.status} db=${ready.data?.database?.ok} queue=${ready.data?.actionQueue?.driver}`);
record('IoT safe mode', ready.data?.deviceControlMode === 'MOCK' && ready.data?.valveDryRun === true && ready.data?.valveRealControlAllowed === false && ready.data?.enableAutoExecution === false, JSON.stringify({ mode: ready.data?.deviceControlMode, dryRun: ready.data?.valveDryRun, real: ready.data?.valveRealControlAllowed, auto: ready.data?.enableAutoExecution }));

const swagger = await fetch(`${origin}/api/docs`);
record('Swagger UI', swagger.status === 200 && (await swagger.text()).includes('swagger-ui'), `http=${swagger.status}`);
const swaggerJson = await fetch(`${origin}/api/docs-json`);
record('Swagger JSON', swaggerJson.status === 200, `http=${swaggerJson.status}`);

const adminLogin = await login('phase5-admin-a@gray.invalid');
const viewerLogin = await login('phase5-viewer-a@gray.invalid');
record('Admin login', [200, 201].includes(adminLogin.status) && Boolean(adminLogin.data?.accessToken) && Boolean(adminLogin.data?.refreshToken), `http=${adminLogin.status}`);
record('Viewer login', [200, 201].includes(viewerLogin.status) && Boolean(viewerLogin.data?.accessToken) && Boolean(viewerLogin.data?.refreshToken), `http=${viewerLogin.status}`);
let adminToken = adminLogin.data?.accessToken;
const viewerToken = viewerLogin.data?.accessToken;

const profile = await request('/auth/profile', { headers: { authorization: `Bearer ${adminToken}` } });
record('JWT profile', profile.status === 200 && profile.data?.user?.id === 'phase5-admin-a', `http=${profile.status} user=${profile.data?.user?.id}`);
const unauth = await request('/auth/profile');
record('JWT required', unauth.status === 401, `http=${unauth.status}`);

const refresh = await request('/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: adminLogin.data?.refreshToken }) });
record('JWT refresh', [200, 201].includes(refresh.status) && Boolean(refresh.data?.accessToken) && Boolean(refresh.data?.refreshToken), `http=${refresh.status}`);
const reusedRefresh = await request('/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: adminLogin.data?.refreshToken }) });
record('JWT refresh rotation', reusedRefresh.status === 401, `reused_http=${reusedRefresh.status}`);
const oldAccess = await request('/auth/profile', { headers: { authorization: `Bearer ${adminToken}` } });
record('Old access invalidated after refresh', oldAccess.status === 401, `http=${oldAccess.status}`);
adminToken = refresh.data?.accessToken;
const refreshedProfile = await request('/auth/profile', { headers: { authorization: `Bearer ${adminToken}` } });
record('Refreshed access profile', refreshedProfile.status === 200 && refreshedProfile.data?.user?.id === 'phase5-admin-a', `http=${refreshedProfile.status}`);

const tenantDenied = await request('/mobile/cockpit?farmId=phase5-farm-b&tenantId=phase5-tenant-b', { headers: { authorization: `Bearer ${adminToken}` } });
record('Tenant isolation A->B', tenantDenied.status === 403, `http=${tenantDenied.status}`);
const ownFarm = await request('/mobile/cockpit?farmId=phase5-farm-a&tenantId=phase5-tenant-a', { headers: { authorization: `Bearer ${adminToken}` } });
record('Tenant own farm access', ownFarm.status === 200, `http=${ownFarm.status}`);

const viewerDenied = await request('/device-control/phase5-valve-a/command', {
  method: 'POST', headers: { authorization: `Bearer ${viewerToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ command: 'VALVE_OPEN' })
});
record('Viewer permission denied', viewerDenied.status === 403, `http=${viewerDenied.status}`);

const mockCommand = await request('/device-control/phase5-valve-a/command', {
  method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ command: 'VALVE_OPEN', payload: { phase5: true } })
});
record('MOCK device command', mockCommand.status === 201 && mockCommand.data?.mode === 'MOCK', `http=${mockCommand.status} mode=${mockCommand.data?.mode} simulated=${mockCommand.data?.simulated}`);

const valve = await request('/device-control/valves/phase5-valve-a/test-open', {
  method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ dryRun: true, testDurationSeconds: 3 })
});
record('Valve dry-run command', valve.status === 201 && valve.data?.dryRun === true && Boolean(valve.data?.commandId), `http=${valve.status} commandId=${valve.data?.commandId} dryRun=${valve.data?.dryRun}`);

if (valve.data?.commandId) {
  const ackBody = { commandId: valve.data.commandId, deviceId: 'phase5-valve-a', valveStatus: 'OPEN', valveOpeningPercent: 5, success: true, timestamp: new Date().toISOString() };
  const unsignedAck = await request('/device-control/valves/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ackBody) });
  record('Unsigned valve ACK rejected', unsignedAck.status === 401, `http=${unsignedAck.status}`);
  const ackJson = JSON.stringify(ackBody);
  const ackTimestamp = String(Math.floor(Date.now() / 1000));
  const ackSignature = createHmac('sha256', process.env.DEVICE_ACK_HMAC_SECRET).update(ackTimestamp).update('.').update(ackJson).digest('hex');
  const ackHeaders = { 'content-type': 'application/json', 'x-agrios-timestamp': ackTimestamp, 'x-agrios-signature': `sha256=${ackSignature}` };
  const ack1 = await request('/device-control/valves/feedback', { method: 'POST', headers: ackHeaders, body: ackJson });
  const ack2 = await request('/device-control/valves/feedback', { method: 'POST', headers: ackHeaders, body: ackJson });
  record('Valve ACK accepted', ack1.status === 201, `http=${ack1.status}`);
  record('Valve ACK idempotent', ack2.status === 201 && ack2.data?.duplicate === true, `http=${ack2.status} duplicate=${ack2.data?.duplicate}`);
}

const queueDriver = await request('/action-queue/driver', { headers: { authorization: `Bearer ${adminToken}` } });
record('BullMQ driver', queueDriver.status === 200 && queueDriver.data?.driver === 'bullmq', `http=${queueDriver.status} driver=${queueDriver.data?.driver}`);
const enqueue = await request('/action-queue/enqueue', {
  method: 'POST', headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ farmId: 'phase5-farm-a', actionPlanId: 'phase5-plan-a', maxRetries: 1 })
});
record('BullMQ enqueue', enqueue.status === 201 && Boolean(enqueue.data?.id), `http=${enqueue.status} jobId=${enqueue.data?.id}`);
if (enqueue.data?.id) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const jobs = await request('/action-queue/jobs?farmId=phase5-farm-a', { headers: { authorization: `Bearer ${adminToken}` } });
  const job = Array.isArray(jobs.data) ? jobs.data.find((item) => item.id === enqueue.data.id) : undefined;
  record('Application queue consumption', jobs.status === 200 && ['SUCCESS', 'DEAD_LETTERED'].includes(job?.status), `http=${jobs.status} status=${job?.status}`);
}

const cors = await request('/health/live', { headers: { origin: 'https://agrios.xyzwtt.com' } });
record('CORS allowed origin', cors.headers.get('access-control-allow-origin') === 'https://agrios.xyzwtt.com', `acao=${cors.headers.get('access-control-allow-origin')}`);
const badCors = await request('/health/live', { headers: { origin: 'https://evil.invalid' } });
record('CORS denied origin', !badCors.headers.get('access-control-allow-origin'), `acao=${badCors.headers.get('access-control-allow-origin')}`);

for (const result of results) console.log(`${result.status}\t${result.name}\t${result.detail}`);
const failures = results.filter((result) => result.status === 'FAIL').length;
const blockers = results.filter((result) => result.status === 'BLOCKER').length;
console.log(JSON.stringify({ total: results.length, passed: results.filter((result) => result.status === 'PASS').length, failures, blockers }));
process.exitCode = failures ? 1 : 0;
import { createHmac } from 'node:crypto';
