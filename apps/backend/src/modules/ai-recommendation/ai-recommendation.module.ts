import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AiRecommendationController } from './ai-recommendation.controller';
import { AiRecommendationService } from './ai-recommendation.service';
import { PromptBuilderService } from './prompt-builder.service';
import { RecommendationExplainerService } from './recommendation-explainer.service';
import { RiskScoreService } from './risk-score.service';
import { TelemetryAnalysisService } from './telemetry-analysis.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [AiRecommendationController],
  providers: [AiRecommendationService, PromptBuilderService, TelemetryAnalysisService, RecommendationExplainerService, RiskScoreService],
  exports: [AiRecommendationService]
})
export class AiRecommendationModule {}
