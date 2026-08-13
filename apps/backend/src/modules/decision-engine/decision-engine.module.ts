import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeviceModule } from '../device/device.module';
import { DeviceControlModule } from '../device-control/device-control.module';
import { ExecutionModule } from '../execution/execution.module';
import { SafetyModule } from '../safety/safety.module';
import { WettingSimulationModule } from '../wetting-simulation/wetting-simulation.module';
import { DecisionEngineController } from './decision-engine.controller';
import { ActionExecutorService } from './action-executor.service';
import { ActionPlannerService } from './action-planner.service';
import { DecisionEngineService } from './decision-engine.service';
import { FieldStateEngineService } from './field-state-engine.service';
import { StrategyEngineService } from './strategy-engine.service';

@Module({
  imports: [AuthModule, DeviceModule, DeviceControlModule, ExecutionModule, SafetyModule, WettingSimulationModule],
  controllers: [DecisionEngineController],
  providers: [ActionExecutorService, ActionPlannerService, DecisionEngineService, FieldStateEngineService, StrategyEngineService],
  exports: [DecisionEngineService, FieldStateEngineService, StrategyEngineService, ActionPlannerService, ActionExecutorService]
})
export class DecisionEngineModule {}
