import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateAnomalyRuleDto } from './dto/create-anomaly-rule.dto';
import { IrrigationMonitoringService } from './irrigation-monitoring.service';

@ApiTags('P11.2 灌溉监测')
@Controller('irrigation-monitoring')
export class IrrigationMonitoringController {
  constructor(private readonly service: IrrigationMonitoringService) {}

  @Post('rules')
  @ApiCreatedResponse({ description: '创建灌溉异常规则' })
  createRule(@Body() dto: CreateAnomalyRuleDto) {
    return this.service.createRule(dto);
  }

  @Get('rules')
  @ApiOkResponse({ description: '查询灌溉异常规则' })
  listRules(@Query() query: Record<string, unknown>) {
    return this.service.listRules(query);
  }

  @Get('anomalies')
  @ApiOkResponse({ description: '查询灌溉异常事件' })
  listAnomalies(@Query() query: Record<string, unknown>) {
    return this.service.listAnomalies(query);
  }

  @Patch('anomalies/:id/handle')
  @ApiOkResponse({ description: '标记异常已处理' })
  handleAnomaly(@Param('id') id: string) {
    return this.service.handleAnomaly(id);
  }
}
