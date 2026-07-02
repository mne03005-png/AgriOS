import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export type P12UserRole =
  | 'FARMER'
  | 'LARGE_GROWER'
  | 'COOPERATIVE_ADMIN'
  | 'DRONE_PILOT'
  | 'MACHINERY_PROVIDER'
  | 'INPUT_STORE'
  | 'PLATFORM_ADMIN'
  | 'TENANT_ADMIN'
  | 'FARM_MANAGER'
  | 'OPERATOR'
  | 'VIEWER';

export class RegisterDto {
  @ApiProperty({ description: '姓名', example: 'Demo 农场管理员' })
  @Allow()
  name!: string;

  @ApiPropertyOptional({ description: '手机号', example: '13800000000' })
  @Allow()
  phone?: string;

  @ApiPropertyOptional({ description: '邮箱', example: 'demo@agrios.local' })
  @Allow()
  email?: string;

  @ApiProperty({ description: '密码', example: 'demo123456' })
  @Allow()
  password!: string;

  @ApiProperty({ description: '用户角色', enum: ['PLATFORM_ADMIN', 'TENANT_ADMIN', 'FARM_MANAGER', 'OPERATOR', 'VIEWER', 'FARMER'], example: 'TENANT_ADMIN' })
  @Allow()
  role!: P12UserRole;

  @ApiPropertyOptional({ description: '所属租户 ID', example: 'demo-tenant' })
  @Allow()
  tenantId?: string;

  @ApiPropertyOptional({ description: '所属农场 ID', example: 'demo' })
  @Allow()
  farmId?: string;
}
