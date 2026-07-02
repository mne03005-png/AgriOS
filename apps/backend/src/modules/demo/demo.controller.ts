import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DemoService } from './demo.service';

@ApiTags('P11.7 Demo')
@Controller('demo')
export class DemoController {
  constructor(private readonly service: DemoService) {}

  @Get('health')
  @ApiOkResponse({ description: 'Demo farm seed health check' })
  health(@Query('farmId') farmId = 'demo') {
    return this.service.health(farmId);
  }
}
