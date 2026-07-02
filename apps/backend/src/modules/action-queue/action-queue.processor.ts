import { Injectable, OnModuleInit } from '@nestjs/common';
import { ActionQueueService } from './action-queue.service';

@Injectable()
export class ActionQueueProcessor implements OnModuleInit {
  constructor(private readonly queue: ActionQueueService) {}

  onModuleInit() {
    setInterval(() => void this.queue.process(), 5000).unref();
  }
}
