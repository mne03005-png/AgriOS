import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

export class RunHydraulicCheckDto {
  @ApiPropertyOptional({ description: '简化沿程损失系数', example: 0.002 })
  @IsOptional()
  @IsNumber()
  simpleLossFactor?: number;
}
