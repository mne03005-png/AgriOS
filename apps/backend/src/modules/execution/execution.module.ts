import { Module } from '@nestjs/common';
import { ApprovalModule } from '../approval/approval.module';
import { OperationLogModule } from '../operation-log/operation-log.module';
import { SafetyModule } from '../safety/safety.module';
import { ExecutionController } from './execution.controller';
import { ExecutionResultLinkerService } from './execution-result-linker.service';
import { ExecutionService } from './execution.service';

@Module({
  imports: [SafetyModule, ApprovalModule, OperationLogModule],
  controllers: [ExecutionController],
  providers: [ExecutionService, ExecutionResultLinkerService],
  exports: [ExecutionService, ExecutionResultLinkerService]
})
export class ExecutionModule {}
