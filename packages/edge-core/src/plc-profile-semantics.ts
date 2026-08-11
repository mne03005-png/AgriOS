export interface PlcProfileMapping {
  logicalName: string;
  type?: string;
  functionCode?: string;
  address: number | null;
  readWrite?: string;
  feedbackPoint?: string;
}

const ALIASES: Record<string, string> = {
  emergency_stop: 'emergencyStop', no_water: 'noWater', overload_trip: 'overloadTrip',
  pump_running_feedback: 'pumpRunningFeedback', pump_stopped_feedback: 'pumpStoppedFeedback',
  valve_open_feedback: 'valveOpenFeedback', valve_close_feedback: 'valveCloseFeedback',
  valve_closed_feedback: 'valveCloseFeedback', controller_health: 'controllerHealth',
  valve_open: 'valveOpen', valve_close: 'valveClose', pump_start: 'pumpStart', pump_stop: 'pumpStop'
};

export function canonicalPlcLogicalName(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const name = value.trim();
  if (!name || name.toUpperCase() === 'UNCONFIRMED') return undefined;
  return ALIASES[name] ?? name;
}

export function findPlcMappingByLogicalName(mapping: PlcProfileMapping[] | undefined, logicalName: string) {
  const canonical = canonicalPlcLogicalName(logicalName);
  if (!canonical) return undefined;
  return mapping?.find((item) => canonicalPlcLogicalName(item.logicalName) === canonical);
}

export function isReadCapableMapping(item: PlcProfileMapping) {
  const mode = String(item.readWrite ?? '').toUpperCase();
  return mode === 'R' || mode === 'READ' || mode === 'RW' || mode === 'READ_WRITE';
}

export function isWriteCapableMapping(item: PlcProfileMapping) {
  const mode = String(item.readWrite ?? '').toUpperCase();
  return mode === 'W' || mode === 'WRITE' || mode === 'RW' || mode === 'READ_WRITE';
}

export function isSupportedFeedbackMapping(item: PlcProfileMapping) {
  const value = String(item.type ?? item.functionCode ?? '').replace(/[\s_-]/g, '').toLowerCase();
  return ['discreteinput','coil','inputregister','holdingregister','fc01','fc1','fc02','fc2','fc03','fc3','fc04','fc4','1','2','3','4'].includes(value);
}

export function expectedFeedbackLogicalName(commandLogicalName: unknown) {
  const name = canonicalPlcLogicalName(commandLogicalName);
  return ({ valveOpen: 'valveOpenFeedback', valveClose: 'valveCloseFeedback', pumpStart: 'pumpRunningFeedback', pumpStop: 'pumpRunningFeedback' } as Record<string,string>)[String(name)];
}
