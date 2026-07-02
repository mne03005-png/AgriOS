import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class ReverseCostDto {
  @ApiProperty({ description: '冲正原因', example: '录入错误，成本作废' })
  @Allow()
  reason!: string;
}
