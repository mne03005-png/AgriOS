import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDissolveFertilizerTaskDto {
  @ApiProperty({ description: '农场 ID', example: 'farm_onion_001' })
  @IsString()
  farmId!: string;

  @ApiProperty({ description: '肥料罐 ID', example: 'tank_001' })
  @IsString()
  tankId!: string;

  @ApiPropertyOptional({ description: '注水量 L', example: 200 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  waterVolumeL?: number;

  @ApiPropertyOptional({ description: '肥料重量 kg', example: 25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fertilizerWeightKg?: number;

  @ApiPropertyOptional({ description: '溶肥时长分钟', example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;
}
