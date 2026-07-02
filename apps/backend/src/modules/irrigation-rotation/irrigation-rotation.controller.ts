import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateRotationGroupDto } from './dto/create-rotation-group.dto';
import { CreateRotationScheduleDto } from './dto/create-rotation-schedule.dto';
import { CreateRotationValveDto } from './dto/create-rotation-valve.dto';
import { StartRotationDto } from './dto/start-rotation.dto';
import { UpdateRotationGroupDto } from './dto/update-rotation-group.dto';
import { IrrigationRotationService } from './irrigation-rotation.service';

@ApiTags('P11.2 轮灌编组')
@Controller('irrigation-rotation')
export class IrrigationRotationController {
  constructor(private readonly service: IrrigationRotationService) {}

  @Post('groups')
  @ApiCreatedResponse({ description: '创建轮灌组' })
  createGroup(@Body() dto: CreateRotationGroupDto) {
    return this.service.createGroup(dto);
  }

  @Get('groups')
  @ApiOkResponse({ description: '查询轮灌组列表' })
  listGroups(@Query() query: Record<string, unknown>) {
    return this.service.listGroups(query);
  }

  @Get('groups/:id')
  @ApiOkResponse({ description: '查询轮灌组详情' })
  getGroup(@Param('id') id: string) {
    return this.service.getGroup(id);
  }

  @Patch('groups/:id')
  @ApiOkResponse({ description: '更新轮灌组' })
  updateGroup(@Param('id') id: string, @Body() dto: UpdateRotationGroupDto) {
    return this.service.updateGroup(id, dto);
  }

  @Post('groups/:id/valves')
  @ApiCreatedResponse({ description: '添加轮灌阀门' })
  addValve(@Param('id') id: string, @Body() dto: CreateRotationValveDto) {
    return this.service.addValve(id, dto);
  }

  @Post('groups/:id/schedules')
  @ApiCreatedResponse({ description: '创建轮灌计划' })
  addSchedule(@Param('id') id: string, @Body() dto: CreateRotationScheduleDto) {
    return this.service.addSchedule(id, dto);
  }

  @Post('groups/:id/start')
  @ApiOkResponse({ description: '启动轮灌，生成动作计划并进入队列' })
  start(@Param('id') id: string, @Body() dto: StartRotationDto) {
    return this.service.start(id, dto);
  }

  @Post('runs/:id/stop')
  @ApiOkResponse({ description: '停止轮灌运行记录' })
  stopRun(@Param('id') id: string) {
    return this.service.stopRun(id);
  }
}
