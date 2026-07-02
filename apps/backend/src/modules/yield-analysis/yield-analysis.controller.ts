import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { YieldAnalysisService } from './yield-analysis.service';

@ApiTags('P11.6 Yield Analysis')
@Controller('yield-analysis')
export class YieldAnalysisController {
  constructor(private readonly service: YieldAnalysisService) {}

  @Post('records')
  @ApiCreatedResponse({ description: '创建产量记录' })
  createRecord(@Body() body: Record<string, unknown>) {
    return this.service.createRecord(body);
  }

  @Get('records')
  @ApiOkResponse({ description: '查询产量记录' })
  records(@Query() query: Record<string, unknown>) {
    return this.service.listRecords(query);
  }

  @Get('factors')
  @ApiOkResponse({ description: '查询产量影响因素' })
  factors(@Query() query: Record<string, unknown>) {
    return this.service.listFactors(query);
  }

  @Get('summary')
  @ApiOkResponse({ description: '产量分析基础汇总' })
  summary(@Query() query: Record<string, unknown>) {
    return this.service.summary(query);
  }
}
