import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class StartFertigationTaskDto {
  @ApiPropertyOptional({ description: '执行备注', example: '人工确认液位后开始施肥' })
  @IsOptional()
  @IsString()
  remark?: string;
}
