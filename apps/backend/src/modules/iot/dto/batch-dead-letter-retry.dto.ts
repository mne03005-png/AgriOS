import { ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class BatchDeadLetterRetryDto {
  @ApiPropertyOptional({ description: '要重试的 Dead Letter ID 列表；为空时按 PENDING 状态取一批', example: ['id1', 'id2'] })
  @Allow()
  ids?: string[];

  @ApiPropertyOptional({ description: '最大处理数量，默认 20，最大 50', example: 20 })
  @Allow()
  maxCount?: number;
}
