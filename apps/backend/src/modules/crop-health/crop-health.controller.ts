import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CropHealthService } from './crop-health.service';

@ApiTags('P11.6 Crop Health')
@Controller('crop-health')
export class CropHealthController {
  constructor(private readonly service: CropHealthService) {}

  @Post('observations')
  @ApiCreatedResponse({ description: '创建病虫害/巡田观察记录' })
  createObservation(@Body() body: Record<string, unknown>) {
    return this.service.createObservation(body);
  }

  @Get('observations')
  @ApiOkResponse({ description: '查询病虫害/巡田观察记录' })
  listObservations(@Query() query: Record<string, unknown>) {
    return this.service.listObservations(query);
  }

  @Get('summary')
  @ApiOkResponse({ description: '病虫害/巡田观察汇总' })
  summary(@Query() query: Record<string, unknown>) {
    return this.service.summary(query);
  }
}
