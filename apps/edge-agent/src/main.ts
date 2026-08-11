import { readFile } from 'node:fs/promises';
import { CoreModbusTcpTransport, PlcTransportPort } from '@agrios/edge-core';
import { EdgeConfig, loadConfig, realWriteEligible } from './config';
import { DisabledPlcTransport, FakePlcTransport } from './device-control';
import { FakeMqttTransport } from './fake-mqtt-transport';
import { EdgeMqttTransport, RuntimeMqttTransport } from './mqtt-transport';
import { EdgeRuntime } from './runtime';

async function main() {
  const configPath = process.env.EDGE_CONFIG_PATH; if (!configPath) throw new Error('EDGE_CONFIG_PATH_REQUIRED');
  const config = await loadConfig(configPath); const mqtt = transport(config); const plc = await plcTransport(config);
  const runtime = new EdgeRuntime(config, mqtt, { executionJournal: process.env.EDGE_EXECUTION_JOURNAL, outcomeJournal: process.env.EDGE_OUTCOME_JOURNAL }, plc.transport, plc.writeEligible);
  let stopping = false;
  const shutdown = async (signal: string) => { if (stopping) return; stopping = true; process.stdin.pause(); process.stdin.removeAllListeners('data'); process.stdout.write(`EDGE_SHUTDOWN signal=${signal}\n`); await runtime.shutdown(); process.exit(0); };
  process.once('SIGTERM', () => { void shutdown('SIGTERM'); }); process.once('SIGINT', () => { void shutdown('SIGINT'); });
  if (process.env.EDGE_TEST_CONTROL_STDIN === 'true') process.stdin.on('data', (value) => { if (value.toString().trim() === 'SHUTDOWN') void shutdown('TEST_STDIN'); });
  await runtime.start(process.env.EDGE_INPUT_PATH, process.env.EDGE_RUN_ONCE === 'true');
  const health = await runtime.health();
  process.stdout.write(`EDGE_AGENT_READY edgeId=${config.edgeId} software=${config.softwareVersion} config=${config.configVersion} network=${health.networkState} storage=${health.storageState} realWrite=${realWriteEligible(config)}\n`);
  if (process.env.EDGE_RUN_ONCE === 'true') await shutdown('RUN_ONCE');
}
function transport(config: EdgeConfig): RuntimeMqttTransport { return process.env.EDGE_MQTT_MODE === 'FAKE' ? new FakeMqttTransport(required('EDGE_FAKE_CLOUD_PATH'), process.env.EDGE_FAKE_MQTT_CONNECTED === 'true', Number(process.env.EDGE_FAKE_LATENCY_MS ?? 0), Number(process.env.EDGE_FAKE_FAILURE_PERCENT ?? 0)) : new EdgeMqttTransport(config); }
async function plcTransport(config: EdgeConfig): Promise<{ transport: PlcTransportPort; writeEligible: boolean }> {
  if (config.plc.transport === 'FAKE') return { transport: new FakePlcTransport(), writeEligible: false };
  const eligible = realWriteEligible(config); if (!eligible || !config.plc.profilePath || !config.plc.host || !config.plc.port) return { transport: new DisabledPlcTransport(), writeEligible: false };
  let profile: any; try { profile = JSON.parse(await readFile(config.plc.profilePath, 'utf8')); } catch { return { transport: new DisabledPlcTransport(), writeEligible: false }; }
  const valid = profile.realHardwareApproved === true && profile.testOnly !== true && Number.isInteger(profile.transport?.unitId) && Array.isArray(profile.mapping) && profile.mapping.length > 0 && profile.mapping.every((item:any)=>Number.isInteger(item.address)&&item.functionCode&&item.functionCode!=='UNCONFIRMED');
  if (!valid) return { transport: new DisabledPlcTransport(), writeEligible: false };
  return { transport: new CoreModbusTcpTransport(() => ({ host: config.plc.host!, port: config.plc.port!, unitId: profile.transport.unitId, connectTimeoutMs: 2000, commandTimeoutMs: 2000, retry: 1 }), () => true), writeEligible: true };
}
function required(key: string) { const value = process.env[key]; if (!value) throw new Error(`${key}_REQUIRED`); return value; }
void main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
