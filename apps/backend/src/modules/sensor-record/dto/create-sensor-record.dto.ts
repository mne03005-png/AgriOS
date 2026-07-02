import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class CreateSensorRecordDto {
  @ApiProperty()
  @Allow()
  deviceId!: string;

  @ApiProperty()
  @Allow()
  fieldId!: string;

  @ApiProperty({ enum: ['SOIL_MOISTURE', 'TEMPERATURE', 'HUMIDITY', 'FLOW', 'WATER_LEVEL'] })
  @Allow()
  type!: 'SOIL_MOISTURE' | 'TEMPERATURE' | 'HUMIDITY' | 'FLOW' | 'WATER_LEVEL';

  @ApiProperty()
  @Allow()
  value!: number;

  @ApiPropertyOptional()
  @Allow()
  unit?: string;

  @ApiProperty()
  @Allow()
  reportedAt!: string;
}
