import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { MobileService } from './mobile.service';

@ApiTags('P11 Mobile Cockpit')
@Controller('mobile')
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @Get('cockpit')
  cockpit(@Query('farmId') farmId: string) {
    return this.mobileService.cockpit(farmId);
  }

  @Get('map')
  map(@Query('farmId') farmId: string) {
    return this.mobileService.map(farmId);
  }

  @Get('fields/:fieldId/detail')
  fieldDetail(@Param('fieldId') fieldId: string) {
    return this.mobileService.fieldDetail(fieldId);
  }

  @Get('ai/recommendations')
  aiRecommendations(@Query('farmId') farmId: string) {
    return this.mobileService.aiRecommendations(farmId);
  }

  @Get('operations')
  operations(@Query('farmId') farmId: string) {
    return this.mobileService.operations(farmId);
  }

  @Post('control/emergency-stop')
  emergencyStop(@Body() body: { farmId?: string; fieldId?: string }) {
    return this.mobileService.emergencyStop(body);
  }

  @Post('control/valve')
  valve(@Body() body: { deviceId: string; command: 'VALVE_OPEN' | 'VALVE_CLOSE'; remark?: string }) {
    return this.mobileService.valve(body);
  }

  @Get('alerts')
  alerts(@Query('farmId') farmId: string) {
    return this.mobileService.alerts(farmId);
  }

  @Get('reports/summary')
  reports(@Query('farmId') farmId: string) {
    return this.mobileService.reportsSummary(farmId);
  }
}
