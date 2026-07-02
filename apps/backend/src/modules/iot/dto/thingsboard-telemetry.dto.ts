import { ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class ThingsBoardTelemetryDto {
  @ApiPropertyOptional({ description: 'ThingsBoard 设备名称', example: 'soil_sensor_001' })
  @Allow()
  deviceName?: string;

  @ApiPropertyOptional({ description: 'ThingsBoard 设备 ID 或遥测来源设备 ID', example: 'd7f4f7b0-1234-11ef-a1b2-0242ac120002' })
  @Allow()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'ThingsBoard 设备 ID，兼容 AgriOS 明确字段', example: 'd7f4f7b0-1234-11ef-a1b2-0242ac120002' })
  @Allow()
  thingsboardDeviceId?: string;

  @ApiPropertyOptional({ description: '遥测时间戳，毫秒', example: 1782780000000 })
  @Allow()
  ts?: number;

  @ApiPropertyOptional({ description: 'ThingsBoard Rule Chain 传入的 values 嵌套遥测值', example: { soilMoisture: 22, temperature: 32, humidity: 65, battery: 88 } })
  @Allow()
  values?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Common real-device wrapper for telemetry values', example: { soilMoisture: 31.2, soilTemperature: 22.5 } })
  @Allow()
  telemetry?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'ThingsBoard Rule Chain metadata，兼容 deviceName / deviceId 来源', example: { deviceName: 'soil_sensor_001' } })
  @Allow()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '土壤湿度，百分比', example: 22 })
  @Allow()
  soilMoisture?: number;

  @ApiPropertyOptional({ description: '温度，摄氏度', example: 32 })
  @Allow()
  temperature?: number;

  @ApiPropertyOptional({ description: '空气湿度，百分比', example: 65 })
  @Allow()
  humidity?: number;

  @ApiPropertyOptional({ description: '设备电量，百分比', example: 88 })
  @Allow()
  battery?: number;

  @ApiPropertyOptional({ description: '原始遥测包，便于追溯 ThingsBoard 推送内容' })
  @Allow()
  rawPayload?: Record<string, unknown>;
}
