import { Module } from '@nestjs/common';
import { FarmActivityController } from './farm-activity.controller';
import { FarmActivityService } from './farm-activity.service';

@Module({
  controllers: [FarmActivityController],
  providers: [FarmActivityService],
  exports: [FarmActivityService]
})
export class FarmActivityModule {}
