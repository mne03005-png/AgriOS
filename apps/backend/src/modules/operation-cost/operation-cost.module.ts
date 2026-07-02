import { Module } from '@nestjs/common';
import { OperationCostController } from './operation-cost.controller';
import { OperationCostService } from './operation-cost.service';

@Module({
  controllers: [OperationCostController],
  providers: [OperationCostService],
  exports: [OperationCostService]
})
export class OperationCostModule {}
