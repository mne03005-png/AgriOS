import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { BasicCrudController } from '../../common/basic-crud.controller';
import { CreateFieldDto } from './dto/create-field.dto';
import { UpdateFieldDto } from './dto/update-field.dto';
import { FieldService } from './field.service';

@ApiTags('Fields')
@Controller('fields')
export class FieldController extends BasicCrudController<CreateFieldDto, UpdateFieldDto> {
  constructor(private readonly fieldService: FieldService) {
    const service = fieldService;
    super(service);
  }

  @Get(':id/summary')
  @ApiOkResponse({ description: '地块聚合信息' })
  @ApiNotFoundResponse({ description: '地块不存在' })
  getSummary(@Param('id') id: string) {
    return this.fieldService.getSummary(id);
  }

  @Get(':id/rotation-advice')
  @ApiOkResponse({ description: '轮作建议' })
  @ApiNotFoundResponse({ description: '地块不存在' })
  getRotationAdvice(@Param('id') id: string) {
    return this.fieldService.getRotationAdvice(id);
  }

  @Get(':id/timeline')
  @ApiOkResponse({ description: '地块时间线' })
  @ApiNotFoundResponse({ description: '地块不存在' })
  getTimeline(@Param('id') id: string, @Query() query: ListQueryDto) {
    return this.fieldService.getTimeline(id, query);
  }
}
