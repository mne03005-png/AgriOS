import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class RunDecisionRequestDto {
  @ApiProperty({ description: 'Farm ID', example: 'farm_id' })
  @Allow()
  farmId!: string;

  @ApiProperty({ description: 'Field ID', example: 'field_id' })
  @Allow()
  fieldId!: string;
}
