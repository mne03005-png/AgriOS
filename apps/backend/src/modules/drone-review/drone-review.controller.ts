import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DroneReviewService } from './drone-review.service';

@ApiTags('P12 Drone Operation Review')
@Controller('drone-operations')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class DroneReviewController {
  constructor(private readonly service: DroneReviewService) {}

  @Get('reviews')
  @Permissions(PERMISSIONS.DRONE_READ)
  @ApiOkResponse({ description: '查询无人机导入审核列表' })
  list(@Query() query: Record<string, unknown>) {
    return this.service.list(query);
  }

  @Get(':id/review')
  @Permissions(PERMISSIONS.DRONE_READ)
  @ApiOkResponse({ description: '查询无人机作业审核详情' })
  findByOperation(@Param('id') id: string) {
    return this.service.findByOperation(id);
  }

  @Post(':id/review/approve')
  @Permissions(PERMISSIONS.DRONE_REVIEW)
  @ApiCreatedResponse({ description: '批准无人机作业导入结果' })
  approve(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.approve(id, body);
  }

  @Post(':id/review/reject')
  @Permissions(PERMISSIONS.DRONE_REVIEW)
  @ApiCreatedResponse({ description: '拒绝无人机作业导入结果' })
  reject(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.reject(id, body);
  }

  @Post(':id/review/link-field')
  @Permissions(PERMISSIONS.DRONE_REVIEW)
  @ApiCreatedResponse({ description: '人工绑定或修正无人机作业地块' })
  linkField(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.linkField(id, body);
  }

  @Post(':id/review/update-coverage')
  @Permissions(PERMISSIONS.DRONE_REVIEW)
  @ApiCreatedResponse({ description: '人工修正覆盖区或航线并重新统计' })
  updateCoverage(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateCoverage(id, body);
  }
}
