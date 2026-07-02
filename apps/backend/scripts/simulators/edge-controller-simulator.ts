import { createServer, IncomingMessage, ServerResponse } from 'http';

type CommandRequest = {
  deviceId?: string;
  requestId?: string;
  payload?: Record<string, unknown>;
};

const port = Number(process.env.EDGE_SIM_PORT ?? 18080);
const commandState = new Map<string, { command: string; payload?: Record<string, unknown>; at: string }>();

const supportedCommands: Record<string, string> = {
  openValve: 'openValve',
  closeValve: 'closeValve',
  setValveOpening: 'setValveOpening',
  startPump: 'startPump',
  stopPump: 'stopPump',
  setPumpFrequency: 'setPumpFrequency',
  startFertigation: 'startFertigation',
  stopFertigation: 'stopFertigation',
  startDissolving: 'startDissolving',
  stopDissolving: 'stopDissolving',
  emergencyStop: 'emergencyStop',
  'open-valve': 'openValve',
  'close-valve': 'closeValve',
  'set-valve-opening': 'setValveOpening',
  'start-pump': 'startPump',
  'stop-pump': 'stopPump',
  'set-pump-frequency': 'setPumpFrequency',
  'start-fertigation': 'startFertigation',
  'stop-fertigation': 'stopFertigation',
  'emergency-stop': 'emergencyStop'
};

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
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as CommandRequest);
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function handleCommand(command: string, request: IncomingMessage, response: ServerResponse) {
  const body = await readBody(request);
  const deviceId = body.deviceId ?? 'unknown-device';
  const ackAt = new Date().toISOString();
  commandState.set(deviceId, { command, payload: body.payload, at: ackAt });
  sendJson(response, 200, {
    success: true,
    ok: true,
    simulated: true,
    command,
    deviceCode: deviceId,
    commandId: body.requestId ?? `${command}-${Date.now()}`,
    status: 'ACKED',
    timestamp: ackAt,
    deviceId,
    requestId: body.requestId,
    payload: body.payload ?? {},
    ackAt,
    message: 'Mock ACK only. No hardware was controlled.'
  });
}

const server = createServer((request, response) => {
  void (async () => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { ok: true, simulated: true, message: 'P13 Edge controller simulator is running' });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/devices') {
      const devices = Array.from(commandState.entries()).map(([deviceId, state]) => ({
        deviceCode: deviceId,
        online: true,
        lastCommand: state.command,
        lastCommandAt: state.at
      }));
      sendJson(response, 200, { ok: true, simulated: true, devices });
      return;
    }
    if (request.method === 'GET' && url.pathname.startsWith('/devices/') && url.pathname.endsWith('/status')) {
      const deviceId = decodeURIComponent(url.pathname.replace('/devices/', '').replace('/status', '').replace(/\/$/, ''));
      sendJson(response, 200, {
        ok: true,
        simulated: true,
        deviceId,
        online: true,
        lastCommand: commandState.get(deviceId) ?? null
      });
      return;
    }
    if (request.method === 'GET' && url.pathname.startsWith('/status/')) {
      const deviceId = decodeURIComponent(url.pathname.replace('/status/', ''));
      sendJson(response, 200, {
        ok: true,
        simulated: true,
        deviceId,
        online: true,
        lastCommand: commandState.get(deviceId) ?? null
      });
      return;
    }
    if (request.method === 'POST' && url.pathname.startsWith('/commands/')) {
      const requestedCommand = url.pathname.replace('/commands/', '');
      const command = supportedCommands[requestedCommand];
      if (!command) {
        sendJson(response, 404, { ok: false, simulated: true, error: `Unsupported mock command: ${command}` });
        return;
      }
      await handleCommand(command, request, response);
      return;
    }
    sendJson(response, 404, { ok: false, simulated: true, error: 'Not found' });
  })().catch((error) => {
    sendJson(response, 500, { ok: false, simulated: true, error: error instanceof Error ? error.message : String(error) });
  });
});

server.listen(port, () => {
  console.log(`[P13 Edge simulator] listening on http://localhost:${port}`);
  console.log('[P13 Edge simulator] mock ACK only. No hardware will be controlled.');
});
