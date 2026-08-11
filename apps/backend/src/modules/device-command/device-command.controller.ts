import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { DeviceCommandService } from './device-command.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';

@ApiTags('DeviceCommand')
@Controller('device-commands')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Permissions(PERMISSIONS.DEVICE_READ)
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
