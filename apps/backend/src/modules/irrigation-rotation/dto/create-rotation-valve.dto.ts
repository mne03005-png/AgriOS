import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateRotationValveDto {
  @ApiProperty({ description: '阀门设备 ID', example: 'device_valve_001' })
  @IsString()
  deviceId!: string;

  @ApiPropertyOptional({ description: '地块 ID', example: 'field_onion_a' })
  @IsOptional()
  @IsString()
  fieldId?: string;

  @ApiPropertyOptional({ description: '灌溉分区 ID', example: 'zone_east_001' })
  @IsOptional()
  @IsString()
  zoneId?: string;

  @ApiProperty({ description: '阀门执行顺序', example: 1 })
  @IsInt()
  @Min(1)
  valveOrder!: number;

  @ApiPropertyOptional({ description: '目标开度百分比', example: 80 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  targetOpeningPercent?: number;

  @ApiPropertyOptional({ description: '最大灌溉分钟数', example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxIrrigationMinutes?: number;
}
