import { Allow } from 'class-validator';

export class CreateUserDto {
  @Allow()
  phone!: string;

  @Allow()
  email?: string;

  @Allow()
  name!: string;

  @Allow()
  role!: 'FARMER' | 'LARGE_GROWER' | 'COOPERATIVE_ADMIN' | 'DRONE_PILOT' | 'MACHINERY_PROVIDER' | 'INPUT_STORE' | 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'FARM_MANAGER' | 'OPERATOR' | 'VIEWER' | 'INSTALLER' | 'MAINTAINER';

  @Allow()
  tenantId?: string;

  @Allow()
  status?: 'ACTIVE' | 'DISABLED';

  @Allow()
  farmId?: string;

  @Allow()
  remark?: string;
}
