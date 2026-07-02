import { Module } from '@nestjs/common';
import { ActionQueueModule } from '../action-queue/action-queue.module';
import { BillingModule } from '../billing/billing.module';
import { FarmActivityModule } from '../farm-activity/farm-activity.module';
import { IrrigationRotationController } from './irrigation-rotation.controller';
import { IrrigationRotationService } from './irrigation-rotation.service';

@Module({
  imports: [ActionQueueModule, BillingModule, FarmActivityModule],
  controllers: [IrrigationRotationController],
  providers: [IrrigationRotationService],
  exports: [IrrigationRotationService]
})
export class IrrigationRotationModule {}
