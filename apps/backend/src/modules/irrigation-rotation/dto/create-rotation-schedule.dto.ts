import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateRotationScheduleDto {
  @ApiProperty({ description: '计划名称', example: '洋葱地 A 晨间轮灌计划' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '计划 JSON', example: { days: ['MON', 'WED'], startTime: '06:00', durationMinutes: 30 } })
  @IsObject()
  scheduleJson!: Record<string, unknown>;

  @ApiPropertyOptional({ description: '是否启用', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
