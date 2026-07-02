import { Injectable } from '@nestjs/common';

@Injectable()
export class PromptBuilderService {
  buildDecisionPrompt(input: Record<string, unknown>) {
    return {
      system: 'You are an agricultural irrigation expert. Explain the decision safely and return structured JSON.',
      context: input,
      constraints: ['Do not recommend automatic pump start without safety approval.', 'Prefer water-saving and crop-safe operation.', 'Explain uncertainty clearly.']
    };
  }
}
