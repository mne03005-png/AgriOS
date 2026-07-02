import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { FarmActivityModule } from '../farm-activity/farm-activity.module';
import { FileSecurityModule } from '../file-security/file-security.module';
import { GisModule } from '../gis/gis.module';
import { DjiImportService } from './dji-import.service';
import { DroneFieldMatchingService } from './drone-field-matching.service';
import { DroneOperationController } from './drone-operation.controller';
import { DroneOperationService } from './drone-operation.service';
import { DroneStatisticsService } from './drone-statistics.service';

@Module({
  imports: [BillingModule, FarmActivityModule, FileSecurityModule, GisModule],
  controllers: [DroneOperationController],
  providers: [DroneOperationService, DjiImportService, DroneStatisticsService, DroneFieldMatchingService],
  exports: [DroneOperationService]
})
export class DroneOperationModule {}
