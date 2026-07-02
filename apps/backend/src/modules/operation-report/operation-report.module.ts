import { Module } from '@nestjs/common';
import { OperationReportController } from './operation-report.controller';
import { OperationReportService } from './operation-report.service';

@Module({
  controllers: [OperationReportController],
  providers: [OperationReportService],
  exports: [OperationReportService]
})
export class OperationReportModule {}
