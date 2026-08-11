import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MobileService } from './mobile.service';

@ApiTags('P11 Mobile Cockpit')
@Controller('mobile')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Permissions(PERMISSIONS.MOBILE_READ)
export class MobileController {
  constructor(private readonly mobileService: MobileService) {}

  @Get('cockpit')
  cockpit(@Req() req: AuthenticatedRequest, @Query('farmId') farmId: string) {
    return this.mobileService.cockpit(farmId, req.user!);
  }

  @Get('map')
  map(@Req() req: AuthenticatedRequest, @Query('farmId') farmId: string) {
    return this.mobileService.map(farmId, req.user!);
  }

  @Get('fields/:fieldId/detail')
  fieldDetail(@Req() req: AuthenticatedRequest, @Param('fieldId') fieldId: string) {
    return this.mobileService.fieldDetail(fieldId, req.user!);
  }

  @Get('ai/recommendations')
  aiRecommendations(@Req() req: AuthenticatedRequest, @Query('farmId') farmId: string) {
    return this.mobileService.aiRecommendations(farmId, req.user!);
  }

  @Get('operations')
  operations(@Req() req: AuthenticatedRequest, @Query('farmId') farmId: string) {
    return this.mobileService.operations(farmId, req.user!);
  }

  @Post('control/emergency-stop')
  @Permissions(PERMISSIONS.EMERGENCY_STOP)
  emergencyStop(@Req() req: AuthenticatedRequest, @Body() body: { farmId?: string; fieldId?: string }) {
    return this.mobileService.emergencyStop(body, req.user!);
  }

  @Post('control/valve')
  @Permissions(PERMISSIONS.IRRIGATION_EXECUTE)
  valve(@Req() req: AuthenticatedRequest, @Body() body: { deviceId: string; command: 'VALVE_OPEN' | 'VALVE_CLOSE'; remark?: string }) {
    return this.mobileService.valve(body, req.user!);
  }

  @Get('alerts')
  alerts(@Req() req: AuthenticatedRequest, @Query('farmId') farmId: string) {
    return this.mobileService.alerts(farmId, req.user!);
  }

  @Get('reports/summary')
  reports(@Req() req: AuthenticatedRequest, @Query('farmId') farmId: string) {
    return this.mobileService.reportsSummary(farmId, req.user!);
  }
}
