import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class CreateDeviceDto {
  @ApiPropertyOptional()
  @Allow()
  fieldId?: string;

  @ApiProperty()
  @Allow()
  code!: string;

  @ApiProperty()
  @Allow()
  name!: string;

  @ApiProperty({ enum: ['SOIL_SENSOR', 'PUMP', 'VALVE', 'FLOW_METER', 'WATER_LEVEL', 'WEATHER_STATION', 'GATEWAY'] })
  @Allow()
  type!: 'SOIL_SENSOR' | 'PUMP' | 'VALVE' | 'FLOW_METER' | 'WATER_LEVEL' | 'WEATHER_STATION' | 'GATEWAY';

  @ApiPropertyOptional()
  @Allow()
  mqttTopic?: string;

  @Allow()
  online?: boolean;

  @Allow()
  currentStatus?: Record<string, unknown>;

  @Allow()
  lastReportedAt?: string;

  @Allow()
  remark?: string;
}
