import { Module } from '@nestjs/common';
import { IrrigationRuleController } from './irrigation-rule.controller';
import { IrrigationRuleService } from './irrigation-rule.service';

@Module({
  controllers: [IrrigationRuleController],
  providers: [IrrigationRuleService],
  exports: [IrrigationRuleService]
})
export class IrrigationRuleModule {}
