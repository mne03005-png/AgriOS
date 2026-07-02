import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateFertilizerTankDto {
  @ApiProperty({ description: '农场 ID', example: 'farm_onion_001' })
  @IsString()
  farmId!: string;

  @ApiProperty({ description: '肥料罐名称', example: '洋葱地 A 水溶肥罐 1' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: '液位设备 ID', example: 'device_tank_001' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: '容量 L', example: 500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityL?: number;

  @ApiPropertyOptional({ description: '当前液位 L', example: 320 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentLevelL?: number;

  @ApiPropertyOptional({ description: '肥料类型', example: '高钾水溶肥' })
  @IsOptional()
  @IsString()
  fertilizerType?: string;
}
