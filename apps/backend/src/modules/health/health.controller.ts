import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { Public } from '../auth/public.decorator';

@ApiTags('P12 Health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get('live')
  @ApiOkResponse({ description: '进程存活检查' })
  live() {
    return this.health.live();
  }

  @Public()
  @Get('ready')
  @ApiOkResponse({ description: '生产就绪检查' })
  ready() {
    return this.health.ready();
  }

  @Get('modules')
  @ApiOkResponse({ description: '关键模块状态' })
  modules() {
    return this.health.modules();
  }

  @Get('metrics')
  @ApiOkResponse({ description: '轻量运行指标' })
  metrics() {
    return this.health.metrics();
  }
}
