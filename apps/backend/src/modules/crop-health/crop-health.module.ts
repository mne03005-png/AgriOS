import { Module } from '@nestjs/common';
import { CropHealthController } from './crop-health.controller';
import { CropHealthService } from './crop-health.service';

@Module({
  controllers: [CropHealthController],
  providers: [CropHealthService],
  exports: [CropHealthService]
})
export class CropHealthModule {}
