import { ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class LinkThingsBoardDeviceDto {
  @ApiPropertyOptional({ example: 'tb-device-id' })
  @Allow()
  thingsboardDeviceId?: string;

  @ApiPropertyOptional({ example: 'FARM-demo-FIELD-A-SOIL-001' })
  @Allow()
  thingsboardDeviceName?: string;

  @ApiPropertyOptional({ example: ['soilMoisture', 'soilTemperature'] })
  @Allow()
  telemetryKeys?: string[];
}
