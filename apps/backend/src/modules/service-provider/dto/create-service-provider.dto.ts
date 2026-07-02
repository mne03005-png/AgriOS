import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow } from 'class-validator';

export class CreateServiceProviderDto {
  @ApiProperty({ description: '服务商名称', example: '李师傅无人机植保服务' })
  @Allow()
  name!: string;

  @ApiProperty({
    description: '服务商类型',
    enum: ['DRONE_PILOT', 'MACHINERY_SERVICE', 'TECHNICIAN', 'INPUT_STORE', 'SEED_CHANNEL', 'FERTILIZER_CHANNEL', 'PESTICIDE_CHANNEL'],
    example: 'DRONE_PILOT'
  })
  @Allow()
  type!: 'DRONE_PILOT' | 'MACHINERY_SERVICE' | 'TECHNICIAN' | 'INPUT_STORE' | 'SEED_CHANNEL' | 'FERTILIZER_CHANNEL' | 'PESTICIDE_CHANNEL';

  @ApiPropertyOptional({ description: '联系方式', example: '13800000001' })
  @Allow()
  contact?: string;

  @ApiPropertyOptional({ description: '服务区域', example: '本县及周边乡镇' })
  @Allow()
  serviceArea?: string;

  @ApiPropertyOptional({ description: '服务内容', example: '洋葱地无人机打药、叶面肥喷施' })
  @Allow()
  serviceContent?: string;

  @ApiPropertyOptional({ description: '价格说明', example: '无人机作业 8 元/亩起' })
  @Allow()
  priceDescription?: string;

  @ApiPropertyOptional({ description: '是否推荐', example: true })
  @Allow()
  recommended?: boolean;

  @ApiPropertyOptional({ description: '备注', example: '合作稳定，响应快' })
  @Allow()
  remark?: string;
}
