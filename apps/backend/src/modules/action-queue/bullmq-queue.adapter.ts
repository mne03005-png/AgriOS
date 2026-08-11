import { QueueAdapter } from './queue-adapter.interface';
import { ControlPriority, bullMqPriority } from '@agrios/edge-core';

export class BullMqQueueAdapter implements QueueAdapter {
  readonly name = 'bullmq';
  readonly handlesProcessing = true;
  private queue: any;
  private worker: any;

  constructor(redisUrl: string, processor: (jobId: string) => Promise<void>) {
    try {
      const { Queue, Worker } = require('bullmq') as {
        Queue: new (name: string, options: Record<string, unknown>) => any;
        Worker: new (name: string, handler: (job: { data?: { jobId?: string } }) => Promise<void>, options: Record<string, unknown>) => any;
      };
      const connection = this.redisConnection(redisUrl);
      this.queue = new Queue('agrios-action-queue', { connection });
      this.worker = new Worker(
        'agrios-action-queue',
        async (job) => {
          const jobId = job.data?.jobId;
          if (!jobId) throw new Error('BullMQ action job is missing jobId');
          await processor(jobId);
        },
        { connection, concurrency: 1 }
      );
      this.worker.on('error', (error: unknown) => console.error('BullMQ worker error', error));
    } catch (error) {
      throw new Error(`BullMQ is not available, falling back to memory queue: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async enqueue(jobId: string, delayMs = 0, priority = ControlPriority.NORMAL_CONTROL) {
    await this.queue.add('action-job', { jobId }, { delay: Math.max(0, delayMs), priority: bullMqPriority(priority), removeOnComplete: 1000, removeOnFail: 1000 });
  }

  next() {
    return undefined;
  }

  async size() {
    return this.queue.getWaitingCount();
  }

  async close() {
    await this.worker.close();
    await this.queue.close();
  }

  private redisConnection(redisUrl: string) {
    const url = new URL(redisUrl);
    if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
      throw new Error('REDIS_URL must use redis:// or rediss://');
    }
    const database = url.pathname.replace(/^\//, '');
    const db = database ? Number(database) : 0;
    if (!Number.isInteger(db) || db < 0) throw new Error('REDIS_URL database must be a non-negative integer');
    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      username: url.username ? decodeURIComponent(url.username) : undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      db,
      tls: url.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null
    };
  }
}
