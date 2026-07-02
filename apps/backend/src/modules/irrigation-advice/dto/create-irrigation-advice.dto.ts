import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class CreateIrrigationAdviceDto {
  @ApiProperty()
  @Allow()
  fieldId!: string;

  @ApiPropertyOptional()
  @Allow()
  deviceId?: string;

  @ApiPropertyOptional()
  @Allow()
  cropSeasonId?: string;

  @ApiProperty()
  @Allow()
  soilMoisture!: number;

  @ApiProperty({ enum: ['SHOULD_IRRIGATE', 'NORMAL', 'STOP_IRRIGATION'] })
  @Allow()
  action!: 'SHOULD_IRRIGATE' | 'NORMAL' | 'STOP_IRRIGATION';

  @ApiProperty()
  @Allow()
  message!: string;

  @ApiProperty({ enum: ['MQTT', 'MANUAL_TEST', 'SYSTEM'] })
  @Allow()
  source!: 'MQTT' | 'MANUAL_TEST' | 'SYSTEM';
}
