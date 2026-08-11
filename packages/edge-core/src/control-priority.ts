export enum ControlPriority {
  EMERGENCY_STOP = 'EMERGENCY_STOP',
  SAFETY_STOP = 'SAFETY_STOP',
  NORMAL_CONTROL = 'NORMAL_CONTROL',
  BACKGROUND = 'BACKGROUND'
}

const rank: Record<ControlPriority, number> = {
  [ControlPriority.EMERGENCY_STOP]: 0,
  [ControlPriority.SAFETY_STOP]: 1,
  [ControlPriority.NORMAL_CONTROL]: 2,
  [ControlPriority.BACKGROUND]: 3
};

const emergency = new Set(['EMERGENCY_STOP']);
const stops = new Set(['PUMP_OFF', 'VALVE_CLOSE', 'IRRIGATION_STOP', 'STOP_FERTIGATION', 'STOP_DISSOLVING', 'SAFE_STOP']);
const starts = new Set(['PUMP_ON', 'VALVE_OPEN', 'IRRIGATION_START', 'START_FERTIGATION', 'START_DISSOLVING', 'SET_PUMP_FREQUENCY', 'SET_VALVE_OPENING']);

export function controlPriority(action: string): ControlPriority {
  if (emergency.has(action)) return ControlPriority.EMERGENCY_STOP;
  if (stops.has(action)) return ControlPriority.SAFETY_STOP;
  return ControlPriority.NORMAL_CONTROL;
}

export function controlPriorityRank(priority: ControlPriority) { return rank[priority]; }

// BullMQ documents lower positive numbers as higher priority; zero means no priority.
export function bullMqPriority(priority: ControlPriority) { return [1, 10, 100, 1000][rank[priority]]; }
export function isDangerousStart(action: string) { return starts.has(action); }
export function isStopAction(action: string) { return emergency.has(action) || stops.has(action); }
