import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CreateIrrigationDesignZoneDto {
  @ApiProperty({ description: '分区名称', example: '洋葱地A一区' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '分区面积，亩', example: 50 })
  @IsNumber()
  @Min(0)
  area!: number;

  @ApiPropertyOptional({ description: '阀门设备 ID', example: 'device_valve_001' })
  @IsOptional()
  @IsString()
  valveDeviceId?: string;

  @ApiProperty({ description: '主管/支管长度，米', example: 420 })
  @IsNumber()
  @Min(0)
  pipeLength!: number;

  @ApiProperty({ description: '管径，毫米', example: 63 })
  @IsNumber()
  @Min(0)
  pipeDiameter!: number;

  @ApiPropertyOptional({ description: '预期流量，L/h', example: 12000 })
  @IsOptional()
  @IsNumber()
  expectedFlowRate?: number;

  @ApiPropertyOptional({ description: '预期压力，bar', example: 1.2 })
  @IsOptional()
  @IsNumber()
  expectedPressure?: number;

  @ApiPropertyOptional({ description: '单次最大灌溉分钟数', example: 60 })
  @IsOptional()
  @IsNumber()
  maxIrrigationMinutes?: number;
}

export class CreateIrrigationDesignDto {
  @ApiProperty({ description: '农场 ID', example: 'farm_001' })
  @IsString()
  farmId!: string;

  @ApiProperty({ description: '地块 ID', example: 'field_001' })
  @IsString()
  fieldId!: string;

  @ApiProperty({ description: '设计名称', example: '洋葱地A滴灌设计' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '作物类型', example: '洋葱' })
  @IsString()
  cropType!: string;

  @ApiProperty({ description: '土壤类型', example: 'loam' })
  @IsString()
  soilType!: string;

  @ApiProperty({ description: '灌溉模式', enum: ['DRIP', 'SPRINKLER', 'PIVOT', 'MICRO_SPRAY'], example: 'DRIP' })
  @IsIn(['DRIP', 'SPRINKLER', 'PIVOT', 'MICRO_SPRAY'])
  designMode!: string;

  @ApiProperty({ description: '设计面积，亩', example: 300 })
  @IsNumber()
  @Min(0)
  area!: number;

  @ApiPropertyOptional({ description: '行距，米', example: 0.3 })
  @IsOptional()
  @IsNumber()
  rowSpacing?: number;

  @ApiPropertyOptional({ description: '株距，米', example: 0.12 })
  @IsOptional()
  @IsNumber()
  plantSpacing?: number;

  @ApiProperty({ description: '毛管间距，米', example: 1.2 })
  @IsNumber()
  @Min(0.01)
  lateralSpacing!: number;

  @ApiProperty({ description: '滴头流量，L/h', example: 1.6 })
  @IsNumber()
  @Min(0)
  emitterFlowRate!: number;

  @ApiProperty({ description: '滴头间距，米', example: 0.3 })
  @IsNumber()
  @Min(0.01)
  emitterSpacing!: number;

  @ApiPropertyOptional({ description: '目标流量，L/h', example: 18000 })
  @IsOptional()
  @IsNumber()
  targetFlowRate?: number;

  @ApiProperty({ description: '目标末端压力，bar', example: 1 })
  @IsNumber()
  targetPressure!: number;

  @ApiProperty({ description: '水源压力，bar', example: 2.2 })
  @IsNumber()
  sourceWaterPressure!: number;

  @ApiPropertyOptional({ description: '设计扩展 JSON', example: { layout: 'north-south' } })
  @IsOptional()
  @IsObject()
  designJson?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '灌溉分区' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateIrrigationDesignZoneDto)
  zones?: CreateIrrigationDesignZoneDto[];
}
