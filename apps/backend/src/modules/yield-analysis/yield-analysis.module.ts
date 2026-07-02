import { Module } from '@nestjs/common';
import { YieldAnalysisController } from './yield-analysis.controller';
import { YieldAnalysisService } from './yield-analysis.service';

@Module({
  controllers: [YieldAnalysisController],
  providers: [YieldAnalysisService],
  exports: [YieldAnalysisService]
})
export class YieldAnalysisModule {}
