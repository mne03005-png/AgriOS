import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum ActionPlanExecutionMode {
  NORMAL = 'NORMAL',
  AUTHORIZED_POLICY_OVERRIDE = 'AUTHORIZED_POLICY_OVERRIDE'
}

export class ExecuteActionPlanDto {
  @ApiPropertyOptional({ enum: ActionPlanExecutionMode, default: ActionPlanExecutionMode.NORMAL })
  @IsOptional()
  @IsEnum(ActionPlanExecutionMode)
  mode?: ActionPlanExecutionMode;

  @ApiPropertyOptional({ description: 'Required audit reason for an authorized soft-policy override' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  overrideReason?: string;
}
