import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LinkDroneOperationFieldDto {
  @ApiPropertyOptional({ description: '地块 ID', example: 'field_onion_a' })
  @IsOptional()
  @IsString()
  fieldId?: string;

  @ApiPropertyOptional({ description: '地块边界 ID', example: 'boundary_001' })
  @IsOptional()
  @IsString()
  fieldBoundaryId?: string;
}
