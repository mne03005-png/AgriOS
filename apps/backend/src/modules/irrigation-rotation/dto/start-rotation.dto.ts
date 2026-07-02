import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class StartRotationDto {
  @ApiPropertyOptional({ description: '轮灌计划 ID', example: 'schedule_001' })
  @IsOptional()
  @IsString()
  scheduleId?: string;

  @ApiPropertyOptional({ description: '启动备注', example: '人工确认后开始轮灌' })
  @IsOptional()
  @IsString()
  remark?: string;
}
