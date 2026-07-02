import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class BatchMarkDeadLetterResolvedDto {
  @ApiProperty({ description: '要标记为已处理的 Dead Letter ID 列表', example: ['id1', 'id2'] })
  @Allow()
  ids!: string[];

  @ApiPropertyOptional({ description: '人工处理备注', example: '人工确认忽略' })
  @Allow()
  remark?: string;
}
