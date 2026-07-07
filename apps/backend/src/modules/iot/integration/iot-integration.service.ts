import { Injectable } from '@nestjs/common';
import { EventBusService } from '../../event-bus/event-bus.service';
import { AdapterCommandDto } from './dto/adapter-command.dto';

@Injectable()
export class IotIntegrationService {
  constructor(private readonly eventBus: EventBusService) {}

  async send(dto: AdapterCommandDto) {
    const result = {
      adapter: dto.adapter,
      deviceId: dto.deviceId,
      command: dto.command,
      payload: dto.payload ?? {},
      sent: false,
      code: 'READ_ONLY_MODE',
      reason: 'Legacy IoT integration command dispatch is disabled. Use the protected device-control API.'
    };
    this.eventBus.publish('iot.adapter.command.blocked', result);
    return result;
  }
}
