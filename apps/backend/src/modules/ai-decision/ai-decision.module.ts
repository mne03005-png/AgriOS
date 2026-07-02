import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { AiDecisionController } from './ai-decision.controller';
import { AiDecisionService } from './ai-decision.service';

@Module({
  imports: [BillingModule],
  controllers: [AiDecisionController],
  providers: [AiDecisionService],
  exports: [AiDecisionService]
})
export class AiDecisionModule {}
