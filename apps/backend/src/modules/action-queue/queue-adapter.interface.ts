import { ControlPriority } from '@agrios/edge-core';

export interface QueueAdapter {
  readonly name: string;
  readonly handlesProcessing?: boolean;
  enqueue(jobId: string, delayMs?: number, priority?: ControlPriority): Promise<void> | void;
  next(): Promise<string | undefined> | string | undefined;
  size(): number | Promise<number>;
  close?(): Promise<void> | void;
}
