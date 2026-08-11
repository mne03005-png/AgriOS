import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApprovalService } from './approval.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';

@ApiTags('P11 审批别名')
@Controller('approvals')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Permissions(PERMISSIONS.APPROVAL_APPROVE)
export class ApprovalsAliasController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get()
  @ApiOkResponse({ description: '审批列表' })
  list(@Query() query: Record<string, unknown>) {
    return this.approvalService.list(query);
  }

  @Post(':id/approve')
  @ApiOkResponse({ description: '审批通过' })
  approve(@Param('id') id: string) {
    return this.approvalService.approve(id);
  }

  @Post(':id/reject')
  @ApiOkResponse({ description: '审批拒绝' })
  reject(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.approvalService.reject(id, body.reason);
  }
}
