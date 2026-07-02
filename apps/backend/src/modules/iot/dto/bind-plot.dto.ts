import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class BindPlotDto {
  @ApiProperty({ description: '要绑定的 AgriOS 地块 ID', example: 'clx_field_onion_a' })
  @Allow()
  plotId!: string;
}
