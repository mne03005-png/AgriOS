import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ActionFeedbackDto } from './dto/action-feedback.dto';
import { ActionPlanExecutionMode, ExecuteActionPlanDto } from './dto/execute-action-plan.dto';
import { RunDecisionDto } from './dto/run-decision.dto';
import { ActionExecutorService } from './action-executor.service';
import { DecisionEngineService } from './decision-engine.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';

@ApiTags('Decision Engine')
@Controller('decision-engine')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class DecisionEngineController {
  constructor(
    private readonly decisionEngineService: DecisionEngineService,
    private readonly actionExecutorService: ActionExecutorService
  ) {}

  @ApiOkResponse({ description: 'Run full field decision pipeline' })
  @Post('fields/:fieldId/run')
  @Permissions(PERMISSIONS.ACTION_EXECUTE)
  runFieldDecision(@Param('fieldId') fieldId: string, @Body() dto: RunDecisionDto) {
    return this.decisionEngineService.runFieldDecision(fieldId, dto);
  }

  @ApiOkResponse({ description: 'List decision records' })
  @Get('decisions')
  @Permissions(PERMISSIONS.IRRIGATION_READ)
  findDecisions(@Query() query: Record<string, unknown>) {
    return this.decisionEngineService.findDecisions(query);
  }

  @ApiOkResponse({ description: 'Get latest field state snapshot' })
  @Get('fields/:fieldId/state/latest')
  @Permissions(PERMISSIONS.IRRIGATION_READ)
  latestFieldState(@Param('fieldId') fieldId: string) {
    return this.decisionEngineService.latestFieldState(fieldId);
  }

  @ApiOkResponse({ description: 'Execute an action plan' })
  @Post('action-plans/:id/execute')
  @Permissions(PERMISSIONS.ACTION_EXECUTE)
  executeActionPlan(@Param('id') id: string, @Body() dto: ExecuteActionPlanDto) {
    return this.actionExecutorService.executePlan(id, { mode: dto.mode ?? ActionPlanExecutionMode.NORMAL, overrideReason: dto.overrideReason });
  }

  @ApiOkResponse({ description: 'Submit action execution feedback' })
  @Patch('action-executions/:id/feedback')
  @Permissions(PERMISSIONS.EDGE_MANAGE)
  actionFeedback(@Param('id') id: string, @Body() dto: ActionFeedbackDto) {
    return this.actionExecutorService.feedback(id, dto);
  }
}
