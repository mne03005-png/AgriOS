import { createServer, IncomingMessage, ServerResponse } from 'http';

type ValveState = 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING' | 'ERROR';
type Scenario = 'normal' | 'failure' | 'timeout' | 'offline' | 'duplicate';

type CommandRequest = {
  deviceId?: string;
  requestId?: string;
  payload?: {
    commandId?: string;
    deviceCode?: string;
    openingPercent?: number;
    dryRun?: boolean;
    timeoutMs?: number;
  };
};

const port = Number(process.env.VALVE_SIM_PORT ?? process.env.EDGE_SIM_PORT ?? 18081);
const scenario = (process.env.SCENARIO ?? 'normal') as Scenario;
const callbackUrl = process.env.AGRIOS_VALVE_FEEDBACK_URL;
const state = new Map<string, { valveStatus: ValveState; valveOpeningPercent: number; lastCommandId?: string; lastCommandStatus?: string }>();

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload, null, 2));
}

function readBody(request: IncomingMessage): Promise<CommandRequest> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('error', reject);
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      resolve(raw ? (JSON.parse(raw) as CommandRequest) : {});
    });
  });
}

async function handleCommand(command: string, request: IncomingMessage, response: ServerResponse) {
  const body = await readBody(request);
  const deviceCode = body.payload?.deviceCode ?? body.deviceId ?? 'demo-valve-001';
  const commandId = body.payload?.commandId ?? body.requestId ?? `valve-sim-${Date.now()}`;

  if (scenario === 'offline') {
    sendJson(response, 503, { ok: false, simulated: true, errorCode: 'VALVE_OFFLINE', commandId, deviceCode });
    return;
  }
  if (scenario === 'timeout') {
    sendJson(response, 202, { ok: true, simulated: true, status: 'EXECUTING', commandId, deviceCode, note: 'Timeout scenario: ACK intentionally withheld.' });
    return;
  }

  const failed = scenario === 'failure';
  const opening = command === 'close-valve' ? 0 : command === 'set-valve-opening' ? Number(body.payload?.openingPercent ?? 0) : command === 'test-valve' ? 5 : 100;
  const next = failed ? { valveStatus: 'ERROR' as ValveState, valveOpeningPercent: 0 } : { valveStatus: opening > 0 ? ('OPEN' as ValveState) : ('CLOSED' as ValveState), valveOpeningPercent: opening };
  state.set(deviceCode, { ...next, lastCommandId: commandId, lastCommandStatus: failed ? 'FAILED' : 'ACKED' });

  const ack = {
    commandId,
    deviceCode,
    valveStatus: next.valveStatus,
    valveOpeningPercent: next.valveOpeningPercent,
    success: !failed,
    errorCode: failed ? 'SIMULATED_VALVE_FAILURE' : null,
    errorMessage: failed ? 'Valve simulator failure scenario.' : null,
    timestamp: new Date().toISOString()
  };
  if (callbackUrl) {
    void fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ack)
    }).catch(() => undefined);
    if (scenario === 'duplicate') {
      void fetch(callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ack)
      }).catch(() => undefined);
    }
  }
  sendJson(response, failed ? 500 : 200, { ok: !failed, simulated: true, status: failed ? 'FAILED' : 'ACKED', ack });
}

const server = createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, scenario === 'offline' ? 503 : 200, { ok: scenario !== 'offline', simulated: true, scenario, message: 'P13.2 valve simulator only. No hardware is controlled.' });
      return;
    }
    if (request.method === 'GET' && url.pathname.startsWith('/devices/') && url.pathname.endsWith('/status')) {
      const deviceCode = decodeURIComponent(url.pathname.replace('/devices/', '').replace('/status', '').replace(/\/$/, ''));
      sendJson(response, 200, { ok: true, simulated: true, deviceCode, ...(state.get(deviceCode) ?? { valveStatus: 'CLOSED', valveOpeningPercent: 0 }) });
      return;
    }
    if (request.method === 'POST' && url.pathname.startsWith('/commands/')) {
      await handleCommand(url.pathname.replace('/commands/', ''), request, response);
      return;
    }
    sendJson(response, 404, { ok: false, simulated: true, error: 'Not found' });
  })().catch((error) => sendJson(response, 500, { ok: false, simulated: true, error: error instanceof Error ? error.message : String(error) }));
});

server.listen(port, () => {
  console.log(`[P13.2 valve simulator] listening on http://localhost:${port}`);
  console.log(`[P13.2 valve simulator] scenario=${scenario}; no real hardware will be controlled.`);
});
