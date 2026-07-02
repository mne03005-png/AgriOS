import { Injectable } from '@nestjs/common';

@Injectable()
export class RecommendationExplainerService {
  build(input: { title: string; evidence: Record<string, unknown>; action: Record<string, unknown> }) {
    return {
      summary: input.title,
      explanation: `基于 ${Object.keys(input.evidence).join(', ') || '现有农业数据'} 生成可解释建议。该建议仅供人工决策，不会自动执行开泵、开阀或无人机控制。`,
      evidenceJson: input.evidence,
      recommendedActionJson: input.action
    };
  }
}
