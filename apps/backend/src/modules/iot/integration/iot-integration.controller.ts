import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdapterCommandDto } from './dto/adapter-command.dto';
import { IotIntegrationService } from './iot-integration.service';

@ApiTags('P11 IoT 适配层')
@Controller('iot/integration')
export class IotIntegrationController {
  constructor(private readonly iotIntegrationService: IotIntegrationService) {}

  @Post('command')
  @ApiOkResponse({ description: '通过统一 IoT 适配层发送设备指令' })
  send(@Body() dto: AdapterCommandDto) {
    return this.iotIntegrationService.send(dto);
  }
}
