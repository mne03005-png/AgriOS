import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { DeviceCommandService } from './device-command.service';

@ApiTags('DeviceCommand')
@Controller('device-commands')
export class DeviceCommandController {
  constructor(private readonly deviceCommandService: DeviceCommandService) {}

  @ApiOkResponse({ description: '设备命令列表' })
  @Get()
  findAll(@Query() query: ListQueryDto) {
    return this.deviceCommandService.findAll(query);
  }

  @ApiOkResponse({ description: '设备命令详情' })
  @ApiNotFoundResponse({ description: '设备命令不存在' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.deviceCommandService.findOne(id);
  }
}
