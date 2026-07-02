import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { FarmActivityService } from './farm-activity.service';

@ApiTags('P11.2 农场活动时间线')
@Controller('farm-activities')
export class FarmActivityController {
  constructor(private readonly farmActivityService: FarmActivityService) {}

  @Get()
  @ApiOkResponse({ description: '查询农场活动时间线' })
  list(@Query() query: Record<string, unknown>) {
    return this.farmActivityService.list(query);
  }
}
