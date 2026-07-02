import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ActionQueueService } from './action-queue.service';

@ApiTags('P11 Action Queue')
@Controller('action-queue')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class ActionQueueController {
  constructor(private readonly queue: ActionQueueService) {}

  @Post('enqueue')
  @Permissions(PERMISSIONS.ACTION_EXECUTE)
  @ApiCreatedResponse({ description: '将 ActionPlan 加入执行队列' })
  enqueue(@Body() body: { farmId: string; actionPlanId: string; scheduledAt?: string; maxRetries?: number }) {
    return this.queue.enqueue(body);
  }

  @Get('jobs')
  @Permissions(PERMISSIONS.ACTION_EXECUTE)
  @ApiOkResponse({ description: '查询执行队列任务' })
  jobs(@Query() query: Record<string, unknown>) {
    return this.queue.list(query);
  }

  @Get('driver')
  @Permissions(PERMISSIONS.ACTION_EXECUTE)
  @ApiOkResponse({ description: '查询队列驱动与 fallback 状态' })
  driver() {
    return this.queue.driverStatus();
  }

  @Post('jobs/:id/retry')
  @Permissions(PERMISSIONS.ACTION_EXECUTE)
  @ApiOkResponse({ description: '重新入队失败或待重试任务' })
  retry(@Param('id') id: string) {
    return this.queue.retry(id);
  }

  @Post('jobs/:id/cancel')
  @Permissions(PERMISSIONS.ACTION_CANCEL)
  @ApiOkResponse({ description: '取消队列任务，不绕过安全控制' })
  cancel(@Param('id') id: string) {
    return this.queue.cancel(id);
  }
}
