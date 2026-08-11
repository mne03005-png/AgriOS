export interface RealPlcWriteGateInput {
  deviceControlMode: string | undefined;
  deviceControlDryRun: string | undefined;
  valveAllowRealControl: string | undefined;
  enableAutoExecution: string | undefined;
  plcTransport: string | undefined;
  plcRealWriteEnabled: string | undefined;
}

export function isRealPlcWriteEnabled(input: RealPlcWriteGateInput) {
  return input.deviceControlMode === 'PLC_GATEWAY'
    && input.deviceControlDryRun === 'false'
    && input.valveAllowRealControl === 'true'
    && input.enableAutoExecution === 'true'
    && input.plcTransport === 'MODBUS_TCP'
    && input.plcRealWriteEnabled === 'true';
}

export function realPlcWriteGateFromEnv(env: NodeJS.ProcessEnv): RealPlcWriteGateInput {
  return {
    deviceControlMode: env.DEVICE_CONTROL_MODE,
    deviceControlDryRun: env.DEVICE_CONTROL_DRY_RUN,
    valveAllowRealControl: env.VALVE_ALLOW_REAL_CONTROL,
    enableAutoExecution: env.ENABLE_AUTO_EXECUTION,
    plcTransport: env.PLC_TRANSPORT,
    plcRealWriteEnabled: env.PLC_REAL_WRITE_ENABLED
  };
}

export function isSafetyDryRunEnabled(value: string | undefined) {
  return value !== 'false';
}

export interface PlcInterlockStatus {
  emergencyStop: boolean;
  noWater: boolean;
  overloadTrip: boolean;
  pumpRunning: boolean;
  valveOpen: boolean;
}

export type PlcInterlockDecision = { allowed: true } | { allowed: false; errorCode: string };

export function evaluatePlcInterlock(action: string, status: PlcInterlockStatus): PlcInterlockDecision {
  if (action === 'PUMP_ON' && (status.emergencyStop || status.noWater || status.overloadTrip || !status.valveOpen)) {
    return { allowed: false, errorCode: 'PUMP_INTERLOCK_BLOCKED' };
  }
  if (action === 'VALVE_OPEN' && status.emergencyStop) return { allowed: false, errorCode: 'EMERGENCY_STOP_ACTIVE' };
  if (action === 'VALVE_CLOSE' && status.pumpRunning) return { allowed: false, errorCode: 'STOP_PUMP_BEFORE_VALVE_CLOSE' };
  return { allowed: true };
}
