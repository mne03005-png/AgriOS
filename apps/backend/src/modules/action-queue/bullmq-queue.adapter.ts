import { QueueAdapter } from './queue-adapter.interface';

export class BullMqQueueAdapter implements QueueAdapter {
  readonly name = 'bullmq';
  private queue: any;
  private readonly localQueue: string[] = [];

  constructor(redisUrl: string) {
    try {
      const { Queue } = require('bullmq') as { Queue: new (name: string, options: Record<string, unknown>) => any };
      this.queue = new Queue('agrios-action-queue', { connection: { url: redisUrl } });
    } catch (error) {
      throw new Error(`BullMQ is not available, falling back to memory queue: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async enqueue(jobId: string) {
    await this.queue.add('action-job', { jobId });
    this.localQueue.push(jobId);
  }

  next() {
    return this.localQueue.shift();
  }

  async size() {
    return this.localQueue.length;
  }
}
