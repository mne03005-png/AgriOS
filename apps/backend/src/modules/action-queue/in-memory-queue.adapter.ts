import { QueueAdapter } from './queue-adapter.interface';

export class InMemoryQueueAdapter implements QueueAdapter {
  readonly name = 'memory';
  private readonly queue: string[] = [];

  enqueue(jobId: string) {
    this.queue.push(jobId);
  }

  next() {
    return this.queue.shift();
  }

  size() {
    return this.queue.length;
  }
}
