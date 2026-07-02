import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateDissolveFertilizerTaskDto } from './dto/create-dissolve-fertilizer-task.dto';
import { CreateFertigationRecipeDto } from './dto/create-fertigation-recipe.dto';
import { CreateFertigationTaskDto } from './dto/create-fertigation-task.dto';
import { CreateFertilizerTankDto } from './dto/create-fertilizer-tank.dto';
import { StartFertigationTaskDto } from './dto/start-fertigation-task.dto';
import { UpdateFertilizerTankDto } from './dto/update-fertilizer-tank.dto';
import { FertigationService } from './fertigation.service';

@ApiTags('P11.2 水肥一体化')
@Controller('fertigation')
export class FertigationController {
  constructor(private readonly service: FertigationService) {}

  @Post('tanks')
  @ApiCreatedResponse({ description: '创建肥料罐' })
  createTank(@Body() dto: CreateFertilizerTankDto) {
    return this.service.createTank(dto);
  }

  @Get('tanks')
  @ApiOkResponse({ description: '查询肥料罐' })
  listTanks(@Query() query: Record<string, unknown>) {
    return this.service.listTanks(query);
  }

  @Patch('tanks/:id')
  @ApiOkResponse({ description: '更新肥料罐' })
  updateTank(@Param('id') id: string, @Body() dto: UpdateFertilizerTankDto) {
    return this.service.updateTank(id, dto);
  }

  @Post('recipes')
  @ApiCreatedResponse({ description: '创建水肥配方' })
  createRecipe(@Body() dto: CreateFertigationRecipeDto) {
    return this.service.createRecipe(dto);
  }

  @Get('recipes')
  @ApiOkResponse({ description: '查询水肥配方' })
  listRecipes(@Query() query: Record<string, unknown>) {
    return this.service.listRecipes(query);
  }

  @Post('tasks')
  @ApiCreatedResponse({ description: '创建水肥任务' })
  createTask(@Body() dto: CreateFertigationTaskDto) {
    return this.service.createTask(dto);
  }

  @Get('tasks')
  @ApiOkResponse({ description: '查询水肥任务' })
  listTasks(@Query() query: Record<string, unknown>) {
    return this.service.listTasks(query);
  }

  @Post('tasks/:id/start')
  @ApiOkResponse({ description: '启动水肥任务，生成动作计划并进入队列' })
  startTask(@Param('id') id: string, @Body() dto: StartFertigationTaskDto) {
    return this.service.startTask(id, dto);
  }

  @Post('tasks/:id/cancel')
  @ApiOkResponse({ description: '取消水肥任务' })
  cancelTask(@Param('id') id: string) {
    return this.service.cancelTask(id);
  }

  @Post('dissolve-tasks')
  @ApiCreatedResponse({ description: '创建溶肥任务' })
  createDissolveTask(@Body() dto: CreateDissolveFertilizerTaskDto) {
    return this.service.createDissolveTask(dto);
  }
}
