import { ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class ExecuteActionPlanDto {
  @ApiPropertyOptional({ description: '是否强制执行空动作或安全提示计划', example: false })
  @Allow()
  force?: boolean;
}
