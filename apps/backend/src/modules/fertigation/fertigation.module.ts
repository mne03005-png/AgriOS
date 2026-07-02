import { Module } from '@nestjs/common';
import { ActionQueueModule } from '../action-queue/action-queue.module';
import { BillingModule } from '../billing/billing.module';
import { FarmActivityModule } from '../farm-activity/farm-activity.module';
import { FertigationController } from './fertigation.controller';
import { FertigationService } from './fertigation.service';

@Module({
  imports: [ActionQueueModule, BillingModule, FarmActivityModule],
  controllers: [FertigationController],
  providers: [FertigationService],
  exports: [FertigationService]
})
export class FertigationModule {}
