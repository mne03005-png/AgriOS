import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CropHealthModule } from '../crop-health/crop-health.module';
import { EventBusModule } from '../event-bus/event-bus.module';
import { FarmActivityModule } from '../farm-activity/farm-activity.module';
import { OperationCostModule } from '../operation-cost/operation-cost.module';
import { YieldAnalysisModule } from '../yield-analysis/yield-analysis.module';
import { DroneStatisticsService } from '../drone-operation/drone-statistics.service';
import { DroneReviewController } from './drone-review.controller';
import { DroneReviewService } from './drone-review.service';

@Module({
  imports: [AuthModule, EventBusModule, FarmActivityModule, OperationCostModule, CropHealthModule, YieldAnalysisModule],
  controllers: [DroneReviewController],
  providers: [DroneReviewService, DroneStatisticsService],
  exports: [DroneReviewService]
})
export class DroneReviewModule {}
