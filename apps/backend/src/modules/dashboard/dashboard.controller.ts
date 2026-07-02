import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('P11 经营仪表盘')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('farms/:farmId')
  @ApiOkResponse({ description: '农场 KPI 总览' })
  farmKpi(@Param('farmId') farmId: string) {
    return this.dashboardService.farmKpi(farmId);
  }
}
