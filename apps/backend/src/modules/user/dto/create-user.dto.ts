import { Allow } from 'class-validator';

export class CreateUserDto {
  @Allow()
  phone!: string;

  @Allow()
  name!: string;

  @Allow()
  role!: 'FARMER' | 'LARGE_GROWER' | 'COOPERATIVE_ADMIN' | 'DRONE_PILOT' | 'MACHINERY_PROVIDER' | 'INPUT_STORE' | 'PLATFORM_ADMIN';

  @Allow()
  farmId?: string;

  @Allow()
  remark?: string;
}
