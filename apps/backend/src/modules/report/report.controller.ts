import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ReportService } from './report.service';

@ApiTags('Reports')
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @ApiOkResponse({ description: '按地块汇总成本' })
  @ApiNotFoundResponse({ description: '地块不存在' })
  @Get('cost/by-field/:fieldId')
  costByField(@Param('fieldId') fieldId: string) {
    return this.reportService.costByField(fieldId);
  }

  @ApiOkResponse({ description: '按农场汇总成本' })
  @ApiNotFoundResponse({ description: '农场不存在' })
  @Get('cost/by-farm/:farmId')
  costByFarm(@Param('farmId') farmId: string) {
    return this.reportService.costByFarm(farmId);
  }
}
