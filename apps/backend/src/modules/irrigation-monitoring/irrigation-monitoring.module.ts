import { Module } from '@nestjs/common';
import { FarmActivityModule } from '../farm-activity/farm-activity.module';
import { IrrigationMonitoringController } from './irrigation-monitoring.controller';
import { IrrigationMonitoringService } from './irrigation-monitoring.service';

@Module({
  imports: [FarmActivityModule],
  controllers: [IrrigationMonitoringController],
  providers: [IrrigationMonitoringService],
  exports: [IrrigationMonitoringService]
})
export class IrrigationMonitoringModule {}
