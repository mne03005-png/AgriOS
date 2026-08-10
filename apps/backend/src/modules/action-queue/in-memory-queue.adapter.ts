import { QueueAdapter } from './queue-adapter.interface';

export class InMemoryQueueAdapter implements QueueAdapter {
  readonly name = 'memory';
  private readonly queue: string[] = [];
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(private readonly onDelayedReady?: () => void) {}

  enqueue(jobId: string, delayMs = 0) {
    if (delayMs > 0) {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        this.queue.push(jobId);
        this.onDelayedReady?.();
      }, delayMs);
      this.timers.add(timer);
      return;
    }
    this.queue.push(jobId);
  }

  next() {
    return this.queue.shift();
  }

  size() {
    return this.queue.length;
  }

  close() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }
}
