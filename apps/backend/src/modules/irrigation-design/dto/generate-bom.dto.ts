import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class GenerateBomDto {
  @ApiPropertyOptional({ description: '是否优先匹配产品库价格', example: true })
  @IsOptional()
  @IsBoolean()
  useProductCatalog?: boolean;
}
