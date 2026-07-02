import { Module } from '@nestjs/common';
import { CropSeasonController } from './crop-season.controller';
import { CropSeasonService } from './crop-season.service';

@Module({
  controllers: [CropSeasonController],
  providers: [CropSeasonService],
  exports: [CropSeasonService]
})
export class CropSeasonModule {}
