import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class CreateIrrigationDto {
  @ApiProperty({ description: '地块ID', example: 'seed-onion-field-a' })
  @Allow()
  fieldId!: string;

  @ApiPropertyOptional({ description: '种植季ID', example: 'clx-crop-season-id' })
  @Allow()
  cropSeasonId?: string;

  @ApiProperty({ description: '开始时间', example: '2026-06-30T08:00:00.000Z' })
  @Allow()
  startTime!: string;

  @Allow()
  endTime?: string;

  @ApiProperty({ description: '灌溉方式', enum: ['MANUAL', 'AUTO', 'SCHEDULED', 'ADVICE_EXECUTED'], example: 'MANUAL' })
  @Allow()
  mode!: 'MANUAL' | 'AUTO' | 'SCHEDULED' | 'ADVICE_EXECUTED';

  @ApiPropertyOptional({ description: '用水量', example: 1200 })
  @Allow()
  waterAmount?: number;

  @Allow()
  pumpDeviceId?: string;

  @Allow()
  valveDeviceId?: string;

  @Allow()
  triggerReason?: string;

  @Allow()
  remark?: string;
}
