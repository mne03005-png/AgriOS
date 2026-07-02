import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { BasicCrudController } from '../../common/basic-crud.controller';
import { CreateCostDto } from './dto/create-cost.dto';
import { ReverseCostDto } from './dto/reverse-cost.dto';
import { UpdateCostDto } from './dto/update-cost.dto';
import { CostService } from './cost.service';

@ApiTags('CostRecords')
@Controller('cost-records')
export class CostController extends BasicCrudController<CreateCostDto, UpdateCostDto> {
  constructor(private readonly costService: CostService) {
    const service = costService;
    super(service);
  }

  @Get('summary/by-season/:cropSeasonId')
  summaryBySeason(@Param('cropSeasonId') cropSeasonId: string) {
    return this.costService.summaryBySeason(cropSeasonId);
  }

  @Patch(':id/reverse')
  @ApiOkResponse({ description: '冲正成本记录' })
  @ApiNotFoundResponse({ description: '成本记录不存在' })
  reverse(@Param('id') id: string, @Body() dto: ReverseCostDto) {
    return this.costService.reverse(id, dto);
  }
}
