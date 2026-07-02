import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';
import { CreateUsageRecordDto } from './dto/create-usage-record.dto';

@ApiTags('P12 Billing')
@Controller('billing')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Permissions(PERMISSIONS.BILLING_MANAGE)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('usage')
  @ApiCreatedResponse({ description: '记录一次商业用量' })
  recordUsage(@Body() dto: CreateUsageRecordDto) {
    return this.billingService.recordUsage(dto);
  }

  @Get('usage')
  @ApiOkResponse({ description: '查询用量记录' })
  listUsage(@Query() query: Record<string, unknown>) {
    return this.billingService.listUsage(query);
  }

  @Get('summary/:tenantId')
  @ApiOkResponse({ description: '租户用量汇总' })
  tenantSummary(@Param('tenantId') tenantId: string) {
    return this.billingService.tenantSummary(tenantId);
  }

  @Post('plans')
  @ApiCreatedResponse({ description: '创建订阅套餐' })
  createPlan(@Body() body: { name: string; code: string; priceMonthly?: number; metadata?: Record<string, unknown> }) {
    return this.billingService.createPlan(body);
  }

  @Get('plans')
  @ApiOkResponse({ description: '查询订阅套餐' })
  listPlans() {
    return this.billingService.listPlans();
  }

  @Get('invoices')
  @ApiOkResponse({ description: '查询账单列表' })
  listInvoices(@Query() query: Record<string, unknown>) {
    return this.billingService.listInvoices(query);
  }
}
