import { ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class RunDecisionDto {
  @ApiPropertyOptional({ description: '是否在生成动作计划后立即执行', example: false })
  @Allow()
  autoExecute?: boolean;

  @ApiPropertyOptional({ description: '本次决策触发来源', example: 'MANUAL_TEST' })
  @Allow()
  source?: string;
}
