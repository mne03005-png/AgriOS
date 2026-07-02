import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class CreateIotDeviceDto {
  @ApiProperty({ description: '设备名称', example: '洋葱地A土壤湿度传感器1' })
  @Allow()
  name!: string;

  @ApiPropertyOptional({ description: 'AgriOS 本地设备编码，可与 ThingsBoard 设备名保持一致', example: 'soil_sensor_001' })
  @Allow()
  code?: string;

  @ApiPropertyOptional({
    description: '设备类型，可选值：SOIL_SENSOR / WEATHER_SENSOR / PUMP / VALVE / CAMERA / OTHER',
    example: 'SOIL_SENSOR'
  })
  @Allow()
  deviceType?: 'SOIL_SENSOR' | 'WEATHER_SENSOR' | 'PUMP' | 'VALVE' | 'CAMERA' | 'OTHER';

  @ApiPropertyOptional({ description: 'ThingsBoard 设备 ID', example: 'd7f4f7b0-1234-11ef-a1b2-0242ac120002' })
  @Allow()
  thingsboardDeviceId?: string;

  @ApiPropertyOptional({ description: 'ThingsBoard 设备 Access Token', example: 'A1_TEST_TOKEN' })
  @Allow()
  thingsboardAccessToken?: string;

  @ApiPropertyOptional({ description: '绑定的 AgriOS 地块 ID', example: 'clx_field_onion_a' })
  @Allow()
  plotId?: string;
}
