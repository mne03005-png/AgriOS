import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ActionFeedbackDto } from './dto/action-feedback.dto';
import { ExecuteActionPlanDto } from './dto/execute-action-plan.dto';
import { RunDecisionDto } from './dto/run-decision.dto';
import { ActionExecutorService } from './action-executor.service';
import { DecisionEngineService } from './decision-engine.service';

@ApiTags('Decision Engine')
@Controller('decision-engine')
export class DecisionEngineController {
  constructor(
    private readonly decisionEngineService: DecisionEngineService,
    private readonly actionExecutorService: ActionExecutorService
  ) {}

  @ApiOkResponse({ description: 'Run full field decision pipeline' })
  @Post('fields/:fieldId/run')
  runFieldDecision(@Param('fieldId') fieldId: string, @Body() dto: RunDecisionDto) {
    return this.decisionEngineService.runFieldDecision(fieldId, dto);
  }

  @ApiOkResponse({ description: 'List decision records' })
  @Get('decisions')
  findDecisions(@Query() query: Record<string, unknown>) {
    return this.decisionEngineService.findDecisions(query);
  }

  @ApiOkResponse({ description: 'Get latest field state snapshot' })
  @Get('fields/:fieldId/state/latest')
  latestFieldState(@Param('fieldId') fieldId: string) {
    return this.decisionEngineService.latestFieldState(fieldId);
  }

  @ApiOkResponse({ description: 'Execute an action plan' })
  @Post('action-plans/:id/execute')
  executeActionPlan(@Param('id') id: string, @Body() dto: ExecuteActionPlanDto) {
    return this.actionExecutorService.executePlan(id, Boolean(dto.force));
  }

  @ApiOkResponse({ description: 'Submit action execution feedback' })
  @Patch('action-executions/:id/feedback')
  actionFeedback(@Param('id') id: string, @Body() dto: ActionFeedbackDto) {
    return this.actionExecutorService.feedback(id, dto);
  }
}
