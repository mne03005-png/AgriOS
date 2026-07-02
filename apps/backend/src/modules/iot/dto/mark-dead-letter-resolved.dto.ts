import { ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class MarkDeadLetterResolvedDto {
  @ApiPropertyOptional({ description: '处理备注', example: '已确认是测试异常数据，标记为已处理' })
  @Allow()
  remark?: string;
}
