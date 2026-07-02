import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class FinishIrrigationDto {
  @ApiPropertyOptional({ description: '本次灌溉用水量', example: 1200 })
  @Allow()
  waterAmount?: number;

  @ApiPropertyOptional({ description: '完成备注', example: '本次灌溉完成' })
  @Allow()
  remark?: string;
}
