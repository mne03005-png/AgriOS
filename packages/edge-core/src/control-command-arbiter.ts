import { ControlPriority, controlPriority, controlPriorityRank, isDangerousStart } from './control-priority';

type CommandIdentity = { action: string; commandId: string; resetOfCommandId?: string };
export function activeEmergencyIdentity(records: Array<{ action: string; commandId: string; resetOfCommandId?: string; result?: Record<string, unknown> }>) {
  let active: string | undefined;
  for (const item of records) { if (item.action === 'EMERGENCY_STOP' && item.result?.status !== 'ALREADY_LATCHED') active = item.commandId; else if (item.action === 'RESET_EMERGENCY_STOP' && item.resetOfCommandId === active) active = undefined; }
  return active;
}
interface Pending<T> { command: CommandIdentity; priority: ControlPriority; sequence: number; generation: number; dispatchEmergency: boolean; execute: (dispatchAllowed: boolean) => Promise<T>; resolve: (value: T) => void; reject: (error: Error) => void; }

export class ControlCommandArbiter {
  private queue: Pending<unknown>[] = [];
  private sequence = 0;
  private draining = false;
  private activeEmergencyCommandId?: string;
  private generation = 0;
  private emergencyDispatchReserved = false;

  restoreEmergencyLatch(activeEmergencyCommandId?: string) { this.activeEmergencyCommandId = activeEmergencyCommandId; if (activeEmergencyCommandId) this.generation += 1; }
  isEmergencyLatched() { return Boolean(this.activeEmergencyCommandId); }
  activeEmergencyId() { return this.activeEmergencyCommandId; }
  currentGeneration() { return this.generation; }

  submit<T>(value: string | CommandIdentity, execute: (dispatchAllowed: boolean) => Promise<T>): Promise<T> {
    const command = typeof value === 'string' ? { action: value, commandId: `${value}:${this.sequence}` } : value;
    const generation = this.generation;
    let dispatchEmergency = false;
    if (command.action === 'EMERGENCY_STOP') {
      if (!this.activeEmergencyCommandId) { this.activeEmergencyCommandId = command.commandId; this.generation += 1; this.emergencyDispatchReserved = false; }
      if (this.activeEmergencyCommandId === command.commandId && !this.emergencyDispatchReserved) { this.emergencyDispatchReserved = true; dispatchEmergency = true; }
    }
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ command, priority: controlPriority(command.action), sequence: this.sequence++, generation, dispatchEmergency, execute, resolve: resolve as any, reject });
      this.queue.sort((a, b) => controlPriorityRank(a.priority) - controlPriorityRank(b.priority) || a.sequence - b.sequence);
      if (!this.draining) queueMicrotask(() => void this.drain());
    });
  }

  private async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length) {
        const item = this.queue.shift()!; const { action, resetOfCommandId } = item.command;
        try {
          if (action === 'RESET_EMERGENCY_STOP') {
            if (!this.activeEmergencyCommandId || resetOfCommandId !== this.activeEmergencyCommandId) throw new Error('EDGE_RESET_LATCH_ID_MISMATCH');
            const result = await item.execute(true);
            if (resetOfCommandId !== this.activeEmergencyCommandId) throw new Error('EDGE_RESET_LATCH_CHANGED');
            this.activeEmergencyCommandId = undefined; this.emergencyDispatchReserved = false; item.resolve(result); continue;
          }
          if (action === 'EMERGENCY_STOP' && !item.dispatchEmergency) { item.resolve(await item.execute(false)); continue; }
          if (isDangerousStart(action) && (this.isEmergencyLatched() || item.generation !== this.generation)) { item.resolve(await item.execute(false)); continue; }
          item.resolve(await item.execute(true));
        } catch (error) { item.reject(error instanceof Error ? error : new Error(String(error))); }
      }
    } finally { this.draining = false; }
  }
}

interface Serialized<T> { action: string; sequence: number; execute: () => Promise<T>; resolve: (value: T) => void; reject: (error: Error) => void; }
export class PriorityCommandSerializer {
  private queue: Serialized<unknown>[] = []; private sequence = 0; private draining = false;
  submit<T>(action: string, execute: () => Promise<T>) { return new Promise<T>((resolve, reject) => { this.queue.push({ action, sequence: this.sequence++, execute, resolve: resolve as any, reject }); this.queue.sort((a, b) => controlPriorityRank(controlPriority(a.action)) - controlPriorityRank(controlPriority(b.action)) || a.sequence - b.sequence); if (!this.draining) queueMicrotask(() => void this.drain()); }); }
  private async drain() { if (this.draining) return; this.draining = true; try { while (this.queue.length) { const item = this.queue.shift()!; try { item.resolve(await item.execute()); } catch (error) { item.reject(error instanceof Error ? error : new Error(String(error))); } } } finally { this.draining = false; } }
}
