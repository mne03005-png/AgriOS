import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class CreateOperationLogDto {
  @ApiPropertyOptional()
  @Allow()
  userId?: string;

  @ApiProperty()
  @Allow()
  action!: string;

  @ApiProperty()
  @Allow()
  targetType!: string;

  @ApiProperty()
  @Allow()
  targetId!: string;

  @ApiProperty()
  @Allow()
  description!: string;

  @ApiPropertyOptional()
  @Allow()
  metadata?: Record<string, unknown>;
}
