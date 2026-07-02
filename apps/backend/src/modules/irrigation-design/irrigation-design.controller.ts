import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateIrrigationDesignDto } from './dto/create-irrigation-design.dto';
import { GenerateBomDto } from './dto/generate-bom.dto';
import { RunHydraulicCheckDto } from './dto/run-hydraulic-check.dto';
import { UpdateIrrigationDesignDto } from './dto/update-irrigation-design.dto';
import { IrrigationDesignService } from './irrigation-design.service';

@ApiTags('P7.1 灌溉工程设计')
@Controller('irrigation-designs')
export class IrrigationDesignController {
  constructor(private readonly service: IrrigationDesignService) {}

  @Post()
  @ApiCreatedResponse({ description: '创建灌溉设计' })
  create(@Body() dto: CreateIrrigationDesignDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOkResponse({ description: '查询灌溉设计列表' })
  findAll(@Query() query: Record<string, unknown>) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ description: '查询灌溉设计详情' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ description: '更新灌溉设计' })
  update(@Param('id') id: string, @Body() dto: UpdateIrrigationDesignDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/generate-bom')
  @ApiOkResponse({ description: '生成灌溉设计 BOM' })
  generateBom(@Param('id') id: string, @Body() dto: GenerateBomDto) {
    return this.service.generateBOM(id, dto);
  }

  @Post(':id/hydraulic-check')
  @ApiOkResponse({ description: '运行简化水力校核' })
  hydraulicCheck(@Param('id') id: string, @Body() dto: RunHydraulicCheckDto) {
    return this.service.runHydraulicCheck(id, dto);
  }
}
