import { findPlcMappingByLogicalName, PlcTransportPort } from '@agrios/edge-core';
import { EdgeConfig, realWriteEligible } from './config';

export class FakePlcTransport implements PlcTransportPort {
  private online = false; readonly writes: Array<{ type: string; address: number; value: unknown }> = [];
  async connect() { this.online = true; } async disconnect() { this.online = false; }
  async healthCheck() { return { connected: this.online, transport: 'FAKE' }; }
  async readCoil() { return false; } async readDiscreteInput() { return false; } async readHoldingRegister() { return 0; } async readInputRegister() { return 0; }
  async writeCoil(address: number, value: boolean) { this.writes.push({ type: 'coil', address, value }); }
  async writeHoldingRegister(address: number, value: number) { this.writes.push({ type: 'register', address, value }); }
  async transaction<T>(operation: () => Promise<T>) { return operation(); }
}

export class DisabledPlcTransport extends FakePlcTransport { async healthCheck() { return { connected: false, transport: 'MODBUS_TCP_DISABLED', error: 'REAL_PROFILE_OR_WRITE_GATES_INVALID' }; } }

export class EdgeDeviceControl {
  constructor(private readonly config: EdgeConfig, private readonly transport: PlcTransportPort, private readonly writeEligible: boolean, private readonly recordExecution: (commandId: string, action: string) => Promise<void>, private readonly profile?: any) {}
  async execute(command: { commandId: string; action: string }) {
    if (this.config.plc.transport === 'FAKE') {
      await this.recordExecution(command.commandId, command.action);
      return { status: 'SUCCEEDED', accepted: true, transportAccepted: true, executed: true, physicalConfirmed: true, transport: 'FAKE', feedback: { fake: true, source: 'FAKE_FEEDBACK', observedAt: new Date().toISOString() } };
    }
    if (!this.writeEligible || !realWriteEligible(this.config)) return { status: 'SAFETY_BLOCKED', accepted: false, executed: false, physicalConfirmed: false, errorCode: 'REAL_WRITE_DISABLED' };
    const output = this.outputPoint(command.action); const expected = this.expectedFeedback(command.action);
    if (!output || !expected) return { status: 'FEEDBACK_UNAVAILABLE', accepted: false, executed: false, physicalConfirmed: false, errorCode: 'EDGE_PROFILE_MAPPING_UNAVAILABLE' };
    const safety = await this.readSafetyStatus();
    if (!safety.ok) return { status: 'FEEDBACK_UNAVAILABLE', accepted: false, executed: false, physicalConfirmed: false, errorCode: safety.errorCode };
    if (command.action === 'PUMP_ON' && (safety.emergencyStop || safety.noWater || safety.overloadTrip || !safety.valveOpen)) return { status: 'SAFETY_BLOCKED', accepted: false, executed: false, physicalConfirmed: false, errorCode: 'PUMP_INTERLOCK_BLOCKED' };
    if (command.action === 'VALVE_CLOSE' && safety.pumpRunning) return { status: 'SAFETY_BLOCKED', accepted: false, executed: false, physicalConfirmed: false, errorCode: 'STOP_PUMP_BEFORE_VALVE_CLOSE' };
    await this.recordExecution(command.commandId, command.action);
    await this.transport.writeCoil(output.address, true);
    const startedAt = new Date().toISOString(); const deadline = Date.now() + this.config.safety.feedbackTimeoutMs;
    while (Date.now() <= deadline) {
      try {
        const observed = await this.readBoolean(expected);
        if (observed === expected.value) return { status: 'PHYSICALLY_CONFIRMED', accepted: true, transportAccepted: true, executed: true, physicalConfirmed: true, startedAt, completedAt: new Date().toISOString(), feedback: { fake: false, source: 'MODBUS_TCP', logicalPoint: expected.logicalName, observedAt: new Date().toISOString(), expectedState: expected.value, observedState: observed } };
      } catch { return { status: 'OUTCOME_UNKNOWN', accepted: true, transportAccepted: true, executed: false, physicalConfirmed: false, errorCode: 'PLC_DISCONNECTED_DURING_CONFIRMATION' }; }
      await new Promise((resolve) => setTimeout(resolve, Math.min(this.config.safety.feedbackPollIntervalMs, Math.max(1, deadline - Date.now()))));
    }
    return { status: 'FEEDBACK_TIMEOUT', accepted: true, transportAccepted: true, executed: false, physicalConfirmed: false, errorCode: 'FEEDBACK_TIMEOUT' };
  }
  health() { return this.transport.healthCheck(); }
  private mapping(logicalName: string) { const value = findPlcMappingByLogicalName(this.profile?.mapping, logicalName); return value && Number.isInteger(value.address) && value.functionCode && value.functionCode !== 'UNCONFIRMED' ? { ...value, address: value.address as number } : undefined; }
  private outputPoint(action: string) { const names: Record<string,string> = { VALVE_OPEN: 'valveOpen', VALVE_CLOSE: 'valveClose', PUMP_ON: 'pumpStart', PUMP_OFF: 'pumpStop', EMERGENCY_STOP: 'pumpStop' }; return this.mapping(names[action]); }
  private expectedFeedback(action: string) { const values: Record<string,{logicalName:string;value:boolean}> = { VALVE_OPEN: { logicalName: 'valveOpenFeedback', value: true }, VALVE_CLOSE: { logicalName: 'valveCloseFeedback', value: true }, PUMP_ON: { logicalName: 'pumpRunningFeedback', value: true }, PUMP_OFF: { logicalName: 'pumpRunningFeedback', value: false }, EMERGENCY_STOP: { logicalName: 'pumpRunningFeedback', value: false } }; const value=values[action]; const point=value?this.mapping(value.logicalName):undefined; return point?{...point,...value}:undefined; }
  private async readSafetyStatus() { try { const required=['emergencyStop','noWater','overloadTrip','pumpRunningFeedback','valveOpenFeedback']; const points=required.map((name)=>this.mapping(name)); if(points.some((item)=>!item))return{ok:false,errorCode:'FEEDBACK_UNAVAILABLE'}; const values:boolean[]=[]; for(const point of points)values.push(await this.readBoolean(point)); return{ok:true,emergencyStop:values[0],noWater:values[1],overloadTrip:values[2],pumpRunning:values[3],valveOpen:values[4]}; }catch{return{ok:false,errorCode:'PLC_STATUS_READ_FAILED'};} }
  private readBoolean(point: any) { const type=String(point.type ?? point.functionCode).toLowerCase(); if(type.includes('discrete')||type==='2')return this.transport.readDiscreteInput(point.address); if(type.includes('coil')||type==='1')return this.transport.readCoil(point.address); if(type.includes('inputregister')||type==='4')return this.transport.readInputRegister(point.address).then(Boolean); if(type.includes('holding')||type==='3')return this.transport.readHoldingRegister(point.address).then(Boolean); return Promise.reject(new Error('FEEDBACK_FUNCTION_UNSUPPORTED')); }
}
