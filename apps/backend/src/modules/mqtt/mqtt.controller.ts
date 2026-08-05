import { Body, Controller, GoneException, Post } from '@nestjs/common';
import { DeviceCommandDto } from './dto/device-command.dto';

@Controller('mqtt')
export class MqttController {
  @Post('commands')
  publishCommand(@Body() _dto: DeviceCommandDto) {
    throw new GoneException('Direct MQTT command endpoint is disabled. Use the protected device-control API.');
  }
}
