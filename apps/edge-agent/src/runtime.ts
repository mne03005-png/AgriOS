import { appendFile, readFile } from 'node:fs/promises';
import { activeEmergencyIdentity, ControlCommandArbiter, EdgeReliabilityAgent, PersistentEdgeStore, PlcTransportPort } from '@agrios/edge-core';
import { CommandAuthenticator } from './authenticator';
import { EdgeConfig, realWriteEligible } from './config';
import { EdgeDeviceControl, FakePlcTransport } from './device-control';
import { RuntimeMqttTransport } from './mqtt-transport';

type Input = { type: 'telemetry' | 'command'; data: Record<string, any> };
export class EdgeRuntime {
  private accepting = true; private startedAt = Date.now(); private healthTimer?: NodeJS.Timeout;
  private readonly store: PersistentEdgeStore; private readonly agent: EdgeReliabilityAgent;
  private authenticator?: CommandAuthenticator; private readonly control: EdgeDeviceControl;
  private readonly commandArbiter = new ControlCommandArbiter();
  constructor(private readonly config: EdgeConfig, private readonly mqtt: RuntimeMqttTransport, private readonly paths: { executionJournal?: string; outcomeJournal?: string }, private readonly plc: PlcTransportPort = new FakePlcTransport(), private readonly plcWriteEligible = false, plcProfile?: any) {
    this.store = new PersistentEdgeStore(config.storage.path, config.storage);
    this.agent = new EdgeReliabilityAgent(this.store, mqtt, { edgeId: config.edgeId, tenantId: config.tenantId, farmId: config.farmId, deviceIds: config.allowedDeviceIds }, { batchSize: 50, retryDelayMs: config.reconnect.initialDelayMs, maxBackoffMs: config.reconnect.maxDelayMs });
    this.control = new EdgeDeviceControl(config, this.plc, plcWriteEligible, async (commandId, action) => { if (paths.executionJournal) await appendFile(paths.executionJournal, `${JSON.stringify({ commandId, action, at: new Date().toISOString() })}\n`); }, plcProfile);
  }
  async start(inputPath?: string, runOnce = false) {
    await this.store.open(); this.authenticator = await CommandAuthenticator.fromKeyFile(this.config.mqtt.hmacKeyPath);
    await this.plc.connect();
    const activeEmergencyCommandId = activeEmergencyIdentity(this.store.snapshot().commands);
    this.commandArbiter.restoreEmergencyLatch(activeEmergencyCommandId);
    this.mqtt.onCommand(async (payload) => this.handleCommand(JSON.parse(payload)));
    await this.connectSafely();
    if (inputPath) await this.processInput(inputPath);
    await this.drain(); await this.publishHealth();
    if (!runOnce) this.healthTimer = setInterval(() => { void this.tick(); }, this.config.healthIntervalMs);
  }
  async shutdown() { this.accepting = false; if (this.healthTimer) clearInterval(this.healthTimer); await this.publishHealth(); await this.mqtt.disconnect(); await this.plc.disconnect(); }
  async health() { const reliability = await this.agent.health(); return { ...reliability, edgeId: this.config.edgeId, softwareVersion: this.config.softwareVersion, configVersion: this.config.configVersion, uptime: Math.floor((Date.now() - this.startedAt) / 1000), mqttConnected: this.mqtt.connected(), plcHealth: await this.control.health(), realWriteEnabled: this.plcWriteEligible && realWriteEligible(this.config) }; }
  private async processInput(path: string) { for (const line of (await readFile(path, 'utf8')).split(/\r?\n/).filter(Boolean)) { if (!this.accepting) break; const input = JSON.parse(line) as Input; if (input.type === 'telemetry') await this.agent.captureTelemetry(input.data as any); else if (input.type === 'command') await this.handleCommand(input.data); } }
  private async handleCommand(data: Record<string, any>) {
    if (!this.accepting) return;
    const signatureValid = this.authenticator?.verify(data) === true;
    try {
      const command = { commandId: String(data.commandId ?? ''), edgeId: String(data.edgeId ?? ''), deviceId: String(data.deviceId ?? ''), tenantId: String(data.tenantId ?? ''), farmId: String(data.farmId ?? ''), action: String(data.action ?? ''), expiresAt: String(data.expiresAt ?? ''), resetOfCommandId: typeof data.resetOfCommandId === 'string' ? data.resetOfCommandId : undefined, signatureValid };
      const existing = this.agent.validateCommand(command);
      if (existing) { await this.outcome({ commandId: data.commandId, outcome: 'DUPLICATE' }); return; }
      const result = await this.commandArbiter.submit({ action: command.action, commandId: command.commandId, resetOfCommandId: command.resetOfCommandId }, (dispatchAllowed) => this.agent.receiveCommand(command, () => dispatchAllowed ? this.control.execute({ commandId: data.commandId, action: data.action }) : Promise.resolve({ status: data.action === 'EMERGENCY_STOP' ? 'ALREADY_LATCHED' : 'SAFETY_BLOCKED', executed: false, errorCode: 'EMERGENCY_STOP_ACTIVE_OR_STALE_START' })));
      await this.outcome({ commandId: data.commandId, outcome: result.duplicate ? 'DUPLICATE' : result.record.ackStatus === 'EXPIRED' ? 'EXPIRED' : 'ACCEPTED' });
    } catch (error) { await this.outcome({ commandId: data.commandId, outcome: 'REJECTED', reason: error instanceof Error ? error.message : String(error) }); }
  }
  private async tick() { if (!this.mqtt.connected()) await this.connectSafely(); await this.drain(); await this.publishHealth(); }
  private async connectSafely() { try { await this.mqtt.connect(); } catch { /* offline store-and-forward remains available */ } }
  private async drain() { while (this.mqtt.connected() && this.store.pendingDepth()) { const result = await this.agent.replay(); if (!result.uploaded) break; } }
  private async publishHealth() { try { await this.mqtt.publishHealth(await this.health()); } catch { /* latest health is transient */ } }
  private async outcome(value: Record<string, unknown>) { if (this.paths.outcomeJournal) await appendFile(this.paths.outcomeJournal, `${JSON.stringify(value)}\n`); }
}
