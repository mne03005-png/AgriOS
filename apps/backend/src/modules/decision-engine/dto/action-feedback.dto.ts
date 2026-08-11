import { ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class ActionFeedbackDto {
  @ApiPropertyOptional({ description: '设备或人工反馈状态', example: 'ACKED' })
  @Allow()
  status?: 'PHYSICALLY_CONFIRMED' | 'FEEDBACK_MISMATCH' | 'FEEDBACK_TIMEOUT' | 'OUTCOME_UNKNOWN' | 'FAILED';

  @ApiPropertyOptional({ description: '反馈备注', example: '水泵已启动，现场人工确认正常' })
  @Allow()
  message?: string;

  @ApiPropertyOptional({ description: '反馈原始数据' })
  @Allow()
  payload?: Record<string, unknown>;
}
