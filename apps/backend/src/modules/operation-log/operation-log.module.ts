import { Global, Module } from '@nestjs/common';
import { RequestContextService } from '../../common/request-context.service';
import { OperationLogController } from './operation-log.controller';
import { OperationLogService } from './operation-log.service';

@Global()
@Module({
  controllers: [OperationLogController],
  providers: [OperationLogService, RequestContextService],
  exports: [OperationLogService, RequestContextService]
})
export class OperationLogModule {}
