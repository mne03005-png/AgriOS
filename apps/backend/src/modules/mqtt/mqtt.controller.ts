import { Body, Controller, Post } from '@nestjs/common';
import { DeviceCommandDto } from './dto/device-command.dto';
import { MqttService } from './mqtt.service';

@Controller('mqtt')
export class MqttController {
  constructor(private readonly mqttService: MqttService) {}

  @Post('commands')
  publishCommand(@Body() dto: DeviceCommandDto) {
    return this.mqttService.publishCommand(dto);
  }
}
