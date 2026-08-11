import { ControlPriority, controlPriority, controlPriorityRank, isDangerousStart } from './control-priority';

interface Pending<T> {
  action: string;
  priority: ControlPriority;
  sequence: number;
  generation: number;
  dispatchEmergency: boolean;
  execute: (dispatchAllowed: boolean) => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export class ControlCommandArbiter {
  private queue: Pending<unknown>[] = [];
  private sequence = 0;
  private draining = false;
  private emergencyLatched = false;
  private generation = 0;
  private emergencyDispatchReserved = false;

  restoreEmergencyLatch(active: boolean) { this.emergencyLatched = active; if (active) this.generation += 1; }
  isEmergencyLatched() { return this.emergencyLatched; }

  submit<T>(action: string, execute: (dispatchAllowed: boolean) => Promise<T>): Promise<T> {
    const generation = this.generation;
    let dispatchEmergency = false;
    if (action === 'EMERGENCY_STOP') {
      if (!this.emergencyLatched) { this.emergencyLatched = true; this.generation += 1; }
      if (!this.emergencyDispatchReserved) { this.emergencyDispatchReserved = true; dispatchEmergency = true; }
    }
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ action, priority: controlPriority(action), sequence: this.sequence++, generation, dispatchEmergency, execute, resolve: resolve as any, reject });
      this.queue.sort((a, b) => controlPriorityRank(a.priority) - controlPriorityRank(b.priority) || a.sequence - b.sequence);
      if (!this.draining) queueMicrotask(() => void this.drain());
    });
  }

  private async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.queue.length) {
        const item = this.queue.shift()!;
        try {
          if (item.action === 'RESET_EMERGENCY_STOP') { this.emergencyLatched = false; item.resolve(await item.execute(true)); continue; }
          if (item.action === 'EMERGENCY_STOP' && !item.dispatchEmergency) { item.resolve(await item.execute(false)); continue; }
          if (isDangerousStart(item.action) && (this.emergencyLatched || item.generation !== this.generation)) { item.resolve(await item.execute(false)); continue; }
          item.resolve(await item.execute(true));
        } catch (error) { item.reject(error instanceof Error ? error : new Error(String(error))); }
      }
    } finally { this.draining = false; }
  }
}
