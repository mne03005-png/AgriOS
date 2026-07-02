import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AiDecisionService } from './ai-decision.service';
import { AiDecisionRequestDto } from './dto/ai-decision-request.dto';

@ApiTags('P11 AI 决策')
@Controller('ai/decision')
export class AiDecisionController {
  constructor(private readonly aiDecisionService: AiDecisionService) {}

  @Post('recommend')
  @ApiOkResponse({ description: '生成生产安全版 AI 农事建议' })
  recommend(@Body() dto: AiDecisionRequestDto) {
    return this.aiDecisionService.recommend(dto);
  }
}
