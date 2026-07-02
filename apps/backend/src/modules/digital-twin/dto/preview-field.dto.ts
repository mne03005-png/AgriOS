import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class PreviewFieldDto {
  @ApiPropertyOptional({ description: '模拟灌溉分钟数', example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  irrigationMinutes?: number;

  @ApiPropertyOptional({ description: '模拟用水量', example: 1200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  waterAmount?: number;
}
