import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { BasicCrudController } from '../../common/basic-crud.controller';
import { DeviceCommandDto } from './dto/device-command.dto';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { DeviceService } from './device.service';

@ApiTags('Devices')
@Controller('devices')
export class DeviceController extends BasicCrudController<CreateDeviceDto, UpdateDeviceDto> {
  constructor(private readonly deviceService: DeviceService) {
    const service = deviceService;
    super(service);
  }

  @Post(':id/command')
  @ApiOkResponse({ description: '下发设备指令并创建 DeviceCommand' })
  @ApiNotFoundResponse({ description: '设备不存在' })
  sendCommand(@Param('id') id: string, @Body() dto: DeviceCommandDto) {
    return this.deviceService.sendCommand(id, dto.command);
  }
}
