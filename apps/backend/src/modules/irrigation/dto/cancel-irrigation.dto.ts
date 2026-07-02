import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class CancelIrrigationDto {
  @ApiProperty({ description: '取消原因', example: '设备异常，取消本次灌溉' })
  @Allow()
  reason!: string;
}
