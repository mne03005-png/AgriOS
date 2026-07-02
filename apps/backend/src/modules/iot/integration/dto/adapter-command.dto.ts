import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class AdapterCommandDto {
  @ApiProperty({ description: '适配器类型', enum: ['thingsboard', 'mock'], example: 'thingsboard' })
  @IsIn(['thingsboard', 'mock'])
  adapter!: 'thingsboard' | 'mock';

  @ApiProperty({ description: '设备 ID 或设备编码', example: 'soil-001' })
  @IsString()
  deviceId!: string;

  @ApiProperty({ description: '设备指令', example: 'PUMP_ON' })
  @IsString()
  command!: string;

  @ApiPropertyOptional({ description: '指令载荷', example: { duration: 30 } })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
