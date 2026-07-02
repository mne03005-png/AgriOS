import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ description: '租户名称', example: '寿光洋葱种植合作社' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '租户类型', enum: ['COMPANY', 'FARM_GROUP', 'COOPERATIVE', 'FAMILY_FARM'], example: 'COOPERATIVE' })
  @IsIn(['COMPANY', 'FARM_GROUP', 'COOPERATIVE', 'FAMILY_FARM'])
  type!: string;

  @ApiPropertyOptional({ description: '租户联系人', example: '王经理' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ description: '联系人手机号', example: '13800000000' })
  @IsOptional()
  @IsString()
  contactPhone?: string;
}
