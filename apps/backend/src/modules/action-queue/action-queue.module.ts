import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DecisionEngineModule } from '../decision-engine/decision-engine.module';
import { ExecutionModule } from '../execution/execution.module';
import { ActionQueueController } from './action-queue.controller';
import { ActionQueueProcessor } from './action-queue.processor';
import { ActionQueueService } from './action-queue.service';

@Module({
  imports: [AuthModule, DecisionEngineModule, ExecutionModule],
  controllers: [ActionQueueController],
  providers: [ActionQueueService, ActionQueueProcessor],
  exports: [ActionQueueService]
})
export class ActionQueueModule {}
