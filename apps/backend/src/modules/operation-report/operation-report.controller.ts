import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { OperationReportService } from './operation-report.service';

@ApiTags('P11.2 作业报告')
@Controller('operation-reports')
export class OperationReportController {
  constructor(private readonly service: OperationReportService) {}

  @Get()
  @ApiOkResponse({ description: '查询作业报告' })
  list(@Query() query: Record<string, unknown>) {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: '查询作业报告详情' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('generate')
  @ApiCreatedResponse({ description: '生成作业报告' })
  generate(@Body() body: { farmId: string; type: string; refId?: string; title?: string }) {
    return this.service.generate(body);
  }
}
