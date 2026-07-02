import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ApprovalService } from './approval.service';

@ApiTags('P11 审批别名')
@Controller('approvals')
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
