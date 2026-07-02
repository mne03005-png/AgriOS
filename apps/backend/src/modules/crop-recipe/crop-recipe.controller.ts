import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CropRecipeService } from './crop-recipe.service';
import { CreateCropIrrigationRecipeDto } from './dto/create-crop-irrigation-recipe.dto';
import { UpdateCropIrrigationRecipeDto } from './dto/update-crop-irrigation-recipe.dto';

@ApiTags('P7.1 作物灌溉配方')
@Controller('crop-recipes')
export class CropRecipeController {
  constructor(private readonly service: CropRecipeService) {}

  @Post()
  @ApiCreatedResponse({ description: '创建作物灌溉配方' })
  create(@Body() dto: CreateCropIrrigationRecipeDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOkResponse({ description: '查询作物灌溉配方列表' })
  findAll(@Query() query: Record<string, unknown>) {
    return this.service.findAll(query);
  }

  @Get('match')
  @ApiOkResponse({ description: '匹配作物灌溉配方' })
  match(@Query() query: { cropType?: string; cropStage?: string; soilType?: string }) {
    return this.service.match(query);
  }

  @Patch(':id')
  @ApiOkResponse({ description: '更新作物灌溉配方' })
  update(@Param('id') id: string, @Body() dto: UpdateCropIrrigationRecipeDto) {
    return this.service.update(id, dto);
  }
}
