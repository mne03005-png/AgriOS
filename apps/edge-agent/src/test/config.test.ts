import { strict as assert } from 'node:assert';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadConfig, realWriteEligible } from '../config';

test('configuration fails closed and real write defaults disabled', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'agrios-edge-config-'));
  try {
    const invalid = join(directory, 'invalid.json'); await writeFile(invalid, '{}');
    await assert.rejects(() => loadConfig(invalid), /EDGE_CONFIG_MISSING/);
    const valid = join(directory, 'valid.json');
    await writeFile(valid, JSON.stringify({ edgeId: 'edge', tenantId: 'tenant', farmId: 'farm', allowedDeviceIds: ['device'], mqtt: { host: 'localhost', port: 8883, clientId: 'edge', hmacKeyPath: join(directory, 'key') }, storage: { path: join(directory, 'store.json') } }));
    const config = await loadConfig(valid); assert.equal(config.safety.realWriteEnabled, false); assert.equal(config.plc.transport, 'FAKE'); assert.equal(realWriteEligible(config, {}), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
