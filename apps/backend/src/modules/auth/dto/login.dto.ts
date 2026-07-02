import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({ description: '手机号', example: '13800000000' })
  @Allow()
  phone?: string;

  @ApiPropertyOptional({ description: '邮箱', example: 'demo@agrios.local' })
  @Allow()
  email?: string;

  @ApiProperty({ description: '密码', example: 'demo123456' })
  @Allow()
  password!: string;
}
