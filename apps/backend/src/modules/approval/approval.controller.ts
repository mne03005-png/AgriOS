import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApprovalService } from './approval.service';
import { CreateApprovalRequestDto } from './dto/create-approval-request.dto';

@ApiTags('P12 Approval')
@Controller('approval')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Post()
  @Permissions(PERMISSIONS.ACTION_EXECUTE)
  @ApiCreatedResponse({ description: '创建审批请求' })
  create(@Body() dto: CreateApprovalRequestDto) {
    return this.approvalService.create(dto);
  }

  @Get()
  @Permissions(PERMISSIONS.APPROVAL_APPROVE)
  @ApiOkResponse({ description: '审批列表' })
  list(@Query() query: Record<string, unknown>) {
    return this.approvalService.list(query);
  }

  @Post(':id/approve')
  @Permissions(PERMISSIONS.APPROVAL_APPROVE)
  @ApiOkResponse({ description: '审批通过' })
  approve(@Param('id') id: string) {
    return this.approvalService.approve(id);
  }

  @Post(':id/reject')
  @Permissions(PERMISSIONS.APPROVAL_APPROVE)
  @ApiOkResponse({ description: '审批拒绝' })
  reject(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.approvalService.reject(id, body.reason);
  }
}
