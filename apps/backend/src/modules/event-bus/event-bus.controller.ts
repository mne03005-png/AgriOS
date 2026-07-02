import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { EventBusService } from './event-bus.service';

@ApiTags('P11 事件总线')
@Controller('event-bus')
export class EventBusController {
  constructor(private readonly eventBus: EventBusService) {}

  @Get('recent')
  @ApiOkResponse({ description: '最近 100 条平台内部事件' })
  recent() {
    return this.eventBus.listRecent();
  }
}
