import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateApprovalRequestDto {
  @ApiProperty({ description: '审批类型', example: 'AUTO_IRRIGATION' })
  @IsString()
  type!: string;

  @ApiProperty({ description: '目标类型', example: 'ActionPlan' })
  @IsString()
  targetType!: string;

  @ApiProperty({ description: '目标 ID', example: 'action_001' })
  @IsString()
  targetId!: string;

  @ApiPropertyOptional({ description: '审批说明', example: '自动灌溉执行前人工确认' })
  @IsOptional()
  @IsString()
  reason?: string;
}
