import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { PrismaService } from '../../prisma/prisma.service';

export type AgriOsEvent = {
  name: string;
  payload: Record<string, unknown>;
  tenantId?: string;
  occurredAt: Date;
};

@Injectable()
export class EventBusService {
  private readonly emitter = new EventEmitter();
  private readonly recentEvents: AgriOsEvent[] = [];

  constructor(private readonly prisma: PrismaService) {}

  publish(name: string, payload: Record<string, unknown>, tenantId?: string) {
    const event = { name, payload, tenantId, occurredAt: new Date() };
    this.recentEvents.unshift(event);
    this.recentEvents.splice(100);
    this.emitter.emit(name, event);
    this.emitter.emit('*', event);
    void (this.prisma as any).eventLog
      ?.create({
        data: {
          tenantId,
          farmId: typeof payload.farmId === 'string' ? payload.farmId : undefined,
          eventType: name,
          entityType: typeof payload.entityType === 'string' ? payload.entityType : undefined,
          entityId: typeof payload.entityId === 'string' ? payload.entityId : undefined,
          payload
        }
      })
      .catch(() => undefined);
    return event;
  }

  subscribe(name: string, listener: (event: AgriOsEvent) => void) {
    this.emitter.on(name, listener);
    return () => this.emitter.off(name, listener);
  }

  listRecent() {
    return this.recentEvents;
  }
}
