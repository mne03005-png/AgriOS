import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { DeviceCommandDto } from './dto/device-command.dto';
import { MqttService } from './mqtt.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';

@Controller('mqtt')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Permissions(PERMISSIONS.DEVICE_MANAGE)
export class MqttController {
  constructor(private readonly mqttService: MqttService) {}

  @Post('commands')
  publishCommand(@Body() dto: DeviceCommandDto) {
    return this.mqttService.publishCommand(dto);
  }
}
