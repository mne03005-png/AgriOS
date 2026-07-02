import { BadRequestException, Injectable } from '@nestjs/common';
import { EventBusService } from '../../event-bus/event-bus.service';
import { MqttService } from '../../mqtt/mqtt.service';
import { AdapterCommandDto } from './dto/adapter-command.dto';

@Injectable()
export class IotIntegrationService {
  constructor(
    private readonly mqttService: MqttService,
    private readonly eventBus: EventBusService
  ) {}

  async send(dto: AdapterCommandDto) {
    if (dto.adapter === 'mock') {
      const result = { adapter: dto.adapter, deviceId: dto.deviceId, command: dto.command, payload: dto.payload ?? {}, sent: true };
      this.eventBus.publish('iot.adapter.mock.command', result);
      return result;
    }
    if (!['PUMP_ON', 'PUMP_OFF', 'VALVE_OPEN', 'VALVE_CLOSE'].includes(dto.command)) {
      throw new BadRequestException('Unsupported ThingsBoard command');
    }
    const result = this.mqttService.publishCommand({
      deviceId: dto.deviceId,
      command: dto.command as 'PUMP_ON' | 'PUMP_OFF' | 'VALVE_OPEN' | 'VALVE_CLOSE',
      payload: dto.payload
    });
    this.eventBus.publish('iot.adapter.thingsboard.command', { deviceId: dto.deviceId, command: dto.command, result });
    return { adapter: dto.adapter, ...result };
  }
}
