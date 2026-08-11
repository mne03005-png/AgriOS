import { QueueAdapter } from './queue-adapter.interface';
import { ControlPriority, controlPriorityRank } from '@agrios/edge-core';

export class InMemoryQueueAdapter implements QueueAdapter {
  readonly name = 'memory';
  private readonly queue: Array<{ jobId: string; priority: ControlPriority; sequence: number }> = [];
  private sequence = 0;
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(private readonly onDelayedReady?: () => void) {}

  enqueue(jobId: string, delayMs = 0, priority = ControlPriority.NORMAL_CONTROL) {
    if (delayMs > 0) {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        this.insert(jobId, priority);
        this.onDelayedReady?.();
      }, delayMs);
      this.timers.add(timer);
      return;
    }
    this.insert(jobId, priority);
  }

  next() {
    return this.queue.shift()?.jobId;
  }

  size() {
    return this.queue.length;
  }

  private insert(jobId: string, priority: ControlPriority) {
    this.queue.push({ jobId, priority, sequence: this.sequence++ });
    this.queue.sort((a, b) => controlPriorityRank(a.priority) - controlPriorityRank(b.priority) || a.sequence - b.sequence);
  }

  close() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }
}
