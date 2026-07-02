import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OperationLogModule } from '../operation-log/operation-log.module';
import { ApprovalController } from './approval.controller';
import { ApprovalsAliasController } from './approvals-alias.controller';
import { ApprovalService } from './approval.service';

@Module({
  imports: [AuthModule, OperationLogModule],
  controllers: [ApprovalController, ApprovalsAliasController],
  providers: [ApprovalService],
  exports: [ApprovalService]
})
export class ApprovalModule {}
