import { Injectable } from '@nestjs/common';
import { ActionPlanner } from './planner/action.planner';
import { OptimizerService } from './optimizer/optimizer.service';
import { StateService } from './state/state.service';
import { StrategySelector } from './strategy/strategy.selector';

@Injectable()
export class DecisionService {
  constructor(
    private readonly stateService: StateService,
    private readonly strategySelector: StrategySelector,
    private readonly optimizerService: OptimizerService,
    private readonly actionPlanner: ActionPlanner
  ) {}

  async run(input: { farmId: string; fieldId: string }) {
    const fieldState = await this.stateService.build(input);
    const selectedStrategy = this.strategySelector.select(fieldState);
    const strategy = this.optimizerService.optimize(fieldState, selectedStrategy);
    const actionPlan = await this.actionPlanner.plan(fieldState, strategy);
    return { fieldState, strategy, actionPlan };
  }
}
