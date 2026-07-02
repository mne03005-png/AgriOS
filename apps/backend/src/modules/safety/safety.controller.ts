import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckSafetyDto } from './dto/check-safety.dto';
import { CreateSafetyPolicyDto } from './dto/create-safety-policy.dto';
import { UpdateSafetyPolicyDto } from './dto/update-safety-policy.dto';
import { SafetyService } from './safety.service';

@ApiTags('P12 Safety')
@Controller('safety')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  @Post('check')
  @Permissions(PERMISSIONS.IRRIGATION_EXECUTE)
  @ApiOkResponse({ description: '执行前安全检查' })
  check(@Body() dto: CheckSafetyDto) {
    return this.safetyService.check(dto);
  }

  @Post('policies')
  @Permissions(PERMISSIONS.SAFETY_MANAGE)
  @ApiCreatedResponse({ description: '创建安全策略' })
  createPolicy(@Body() dto: CreateSafetyPolicyDto) {
    return this.safetyService.createPolicy(dto);
  }

  @Get('policies')
  @Permissions(PERMISSIONS.SAFETY_MANAGE)
  @ApiOkResponse({ description: '安全策略列表' })
  policies(@Query() query: Record<string, unknown>) {
    return this.safetyService.listPolicies(query);
  }

  @Patch('policies/:id')
  @Permissions(PERMISSIONS.SAFETY_MANAGE)
  @ApiOkResponse({ description: '更新安全策略' })
  updatePolicy(@Param('id') id: string, @Body() dto: UpdateSafetyPolicyDto) {
    return this.safetyService.updatePolicy(id, dto);
  }

  @Post('emergency-stop')
  @Permissions(PERMISSIONS.EMERGENCY_STOP)
  @ApiOkResponse({ description: '创建或开启急停策略' })
  emergencyStop(@Body() body: { farmId?: string; fieldId?: string; enabled?: boolean }) {
    return this.safetyService.emergencyStop(body);
  }

  @Get('alerts')
  @Permissions(PERMISSIONS.SAFETY_MANAGE)
  @ApiOkResponse({ description: '安全告警列表' })
  alerts(@Query() query: Record<string, unknown>) {
    return this.safetyService.listAlerts(query);
  }
}
