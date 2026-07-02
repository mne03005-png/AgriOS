import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { OperationCostService } from './operation-cost.service';

@ApiTags('P11.6 Operation Costs')
@Controller('operation-costs')
export class OperationCostController {
  constructor(private readonly service: OperationCostService) {}

  @Post()
  @ApiCreatedResponse({ description: '创建作业成本记录' })
  create(@Body() body: Record<string, unknown>) {
    return this.service.create(body);
  }

  @Get()
  @ApiOkResponse({ description: '查询作业成本记录' })
  list(@Query() query: Record<string, unknown>) {
    return this.service.list(query);
  }

  @Get('summary')
  @ApiOkResponse({ description: '作业成本汇总' })
  summary(@Query() query: Record<string, unknown>) {
    return this.service.summary(query);
  }
}
