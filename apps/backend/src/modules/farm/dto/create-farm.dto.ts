import { Allow } from 'class-validator';

export class CreateFarmDto {
  @Allow()
  name!: string;

  @Allow()
  type!: 'FAMILY' | 'COOPERATIVE' | 'COMPANY';

  @Allow()
  address?: string;

  @Allow()
  contactName?: string;

  @Allow()
  contactPhone?: string;

  @Allow()
  remark?: string;
}
