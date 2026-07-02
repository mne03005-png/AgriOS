import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiRecommendationService } from './ai-recommendation.service';
import { TelemetryAnalysisService } from './telemetry-analysis.service';

@ApiTags('P11 AI 推荐解释')
@Controller('ai-recommendations')
export class AiRecommendationController {
  constructor(
    private readonly service: AiRecommendationService,
    private readonly analyzer: TelemetryAnalysisService
  ) {}

  @Post('analyze/farm/:farmId')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.AI_READ)
  analyzeFarm(@Param('farmId') farmId: string) {
    return this.analyzer.analyzeFarm(farmId);
  }

  @Post('analyze/field/:fieldId')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.AI_READ)
  analyzeField(@Param('fieldId') fieldId: string) {
    return this.analyzer.analyzeField(fieldId);
  }

  @Get()
  @UseGuards(TenantGuard)
  list(@Query() query: Record<string, unknown>) {
    return this.service.list(query);
  }

  @Get('latest')
  @UseGuards(TenantGuard)
  latestByFarm(@Query('farmId') farmId: string) {
    return this.service.latest(farmId);
  }

  @Post(':id/dismiss')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.AI_READ)
  dismiss(@Param('id') id: string) {
    return this.service.dismiss(id);
  }

  @Post(':id/resolve')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.AI_READ)
  resolve(@Param('id') id: string) {
    return this.service.resolve(id);
  }

  @Post('explain-decision')
  @ApiOkResponse({ description: '解释一次决策' })
  explain(@Body() body: { decisionId?: string; actionPlanId?: string; fieldId?: string }) {
    return this.service.explainDecision(body);
  }

  @Get('field/:fieldId/latest')
  @ApiOkResponse({ description: '查询地块最新 AI 推荐解释' })
  latestFieldExplanation(@Param('fieldId') fieldId: string) {
    return this.service.latestByField(fieldId);
  }
}
