export interface QueueAdapter {
  readonly name: string;
  enqueue(jobId: string): Promise<void> | void;
  next(): Promise<string | undefined> | string | undefined;
  size(): number | Promise<number>;
}
