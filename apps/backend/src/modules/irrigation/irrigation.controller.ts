import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { BasicCrudController } from '../../common/basic-crud.controller';
import { CreateIrrigationDto } from './dto/create-irrigation.dto';
import { CancelIrrigationDto } from './dto/cancel-irrigation.dto';
import { FinishIrrigationDto } from './dto/finish-irrigation.dto';
import { UpdateIrrigationDto } from './dto/update-irrigation.dto';
import { IrrigationService } from './irrigation.service';

@ApiTags('IrrigationRecords')
@Controller('irrigation-records')
export class IrrigationController extends BasicCrudController<CreateIrrigationDto, UpdateIrrigationDto> {
  constructor(private readonly irrigationService: IrrigationService) {
    const service = irrigationService;
    super(service);
  }

  @Patch(':id/finish')
  @ApiOkResponse({ description: '结束灌溉记录' })
  @ApiNotFoundResponse({ description: '灌溉记录不存在' })
  finish(@Param('id') id: string, @Body() dto: FinishIrrigationDto) {
    return this.irrigationService.finish(id, dto);
  }

  @Patch(':id/cancel')
  @ApiOkResponse({ description: '取消灌溉记录' })
  @ApiNotFoundResponse({ description: '灌溉记录不存在' })
  cancel(@Param('id') id: string, @Body() dto: CancelIrrigationDto) {
    return this.irrigationService.cancel(id, dto);
  }
}
