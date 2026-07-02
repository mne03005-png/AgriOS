import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { ExecuteIrrigationAdviceDto } from './dto/execute-irrigation-advice.dto';
import { IrrigationAdviceService } from './irrigation-advice.service';

@ApiTags('IrrigationAdvice')
@Controller('irrigation-advices')
export class IrrigationAdviceController {
  constructor(private readonly irrigationAdviceService: IrrigationAdviceService) {}

  @Get()
  findAll(@Query() query: ListQueryDto) {
    return this.irrigationAdviceService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.irrigationAdviceService.findOne(id);
  }

  @Patch(':id/confirm')
  @ApiOkResponse({ description: '确认灌溉建议' })
  @ApiNotFoundResponse({ description: '灌溉建议不存在' })
  confirm(@Param('id') id: string) {
    return this.irrigationAdviceService.confirm(id);
  }

  @Patch(':id/ignore')
  @ApiOkResponse({ description: '忽略灌溉建议' })
  @ApiNotFoundResponse({ description: '灌溉建议不存在' })
  ignore(@Param('id') id: string) {
    return this.irrigationAdviceService.ignore(id);
  }

  @Patch(':id/execute')
  @ApiOkResponse({ description: '人工执行灌溉建议' })
  @ApiBadRequestResponse({ description: '状态不允许执行' })
  @ApiNotFoundResponse({ description: '灌溉建议或设备不存在' })
  execute(@Param('id') id: string, @Body() dto: ExecuteIrrigationAdviceDto) {
    return this.irrigationAdviceService.execute(id, dto);
  }
}
