import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class ConfirmBindingCandidateDto {
  @ApiProperty({ description: '确认绑定的 AgriOS Field ID', example: 'field_or_plot_id' })
  @Allow()
  plotId!: string;

  @ApiProperty({ description: '候选来源', example: 'THINGSBOARD_RELATION' })
  @Allow()
  source!: 'THINGSBOARD_ATTRIBUTE' | 'THINGSBOARD_RELATION' | 'MANUAL';

  @ApiPropertyOptional({ description: '人工确认备注', example: '人工确认 relation 对应此地块' })
  @Allow()
  remark?: string;

  @ApiPropertyOptional({ description: '是否强制覆盖已有 MANUAL 绑定', example: false })
  @Allow()
  force?: boolean;
}
