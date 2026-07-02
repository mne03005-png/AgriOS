import { Module } from '@nestjs/common';
import { ActionPlanner } from './planner/action.planner';
import { DecisionController } from './decision.controller';
import { DecisionService } from './decision.service';
import { OptimizerService } from './optimizer/optimizer.service';
import { StateService } from './state/state.service';
import { StrategySelector } from './strategy/strategy.selector';

@Module({
  controllers: [DecisionController],
  providers: [ActionPlanner, DecisionService, OptimizerService, StateService, StrategySelector],
  exports: [DecisionService]
})
export class DecisionModule {}
