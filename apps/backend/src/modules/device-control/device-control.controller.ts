import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeviceControlService } from './device-control.service';
import { DeviceControlCommandDto } from './dto/device-control-command.dto';
import { ValveControlService } from './valve-control.service';
import { SetValveOpeningDto, TestOpenValveDto, ValveDryRunDto, ValveFeedbackDto } from './protocols/valve-control.protocol';

@ApiTags('P12 Device Control')
@Controller('device-control')
export class DeviceControlController {
  constructor(
    private readonly deviceControlService: DeviceControlService,
    private readonly valveControlService: ValveControlService
  ) {}

  @Get('mode/status')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  status() {
    return this.deviceControlService.status();
  }

  @Post(':id/command')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  @ApiOkResponse({ description: '发送设备控制命令，真实执行仍必须经过 Safety / Approval / ActionQueue / DeviceControl 链路' })
  send(@Param('id') id: string, @Body() dto: DeviceControlCommandDto) {
    return this.deviceControlService.send(id, dto);
  }

  @Post(':id/start-irrigation')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.IRRIGATION_EXECUTE)
  @ApiOkResponse({ description: '启动灌溉设备。生产环境不得绕过审批链路直接调用。' })
  start(@Param('id') id: string, @Body() body: { remark?: string }) {
    return this.deviceControlService.startIrrigation(id, body.remark);
  }

  @Post(':id/stop-irrigation')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.IRRIGATION_EXECUTE)
  @ApiOkResponse({ description: '停止灌溉设备。' })
  stop(@Param('id') id: string, @Body() body: { remark?: string }) {
    return this.deviceControlService.stopIrrigation(id, body.remark);
  }

  @Post('valves/feedback')
  @ApiOkResponse({ description: 'Receive valve command ACK or telemetry feedback from ThingsBoard, Edge, or MQTT bridge.' })
  valveFeedback(@Body() dto: ValveFeedbackDto) {
    return this.valveControlService.handleValveTelemetryFeedback(dto);
  }

  @Post('valves/:deviceId/open')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  openValve(@Param('deviceId') deviceId: string, @Body() dto: ValveDryRunDto) {
    return this.valveControlService.requestOpenValve(deviceId, dto);
  }

  @Post('valves/:deviceId/close')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  closeValve(@Param('deviceId') deviceId: string, @Body() dto: ValveDryRunDto) {
    return this.valveControlService.requestCloseValve(deviceId, dto);
  }

  @Post('valves/:deviceId/set-opening')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  setValveOpening(@Param('deviceId') deviceId: string, @Body() dto: SetValveOpeningDto) {
    return this.valveControlService.requestSetValveOpening(deviceId, dto.openingPercent, dto.dryRun);
  }

  @Post('valves/:deviceId/test-open')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_MANAGE)
  testOpenValve(@Param('deviceId') deviceId: string, @Body() dto: TestOpenValveDto) {
    return this.valveControlService.requestTestOpen(deviceId, dto.testDurationSeconds, dto.dryRun);
  }

  @Get('valves/:deviceId/status')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  valveStatus(@Param('deviceId') deviceId: string) {
    return this.valveControlService.getValveStatus(deviceId);
  }

  @Get('valves/:deviceId/commands')
  @UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
  @Permissions(PERMISSIONS.DEVICE_READ)
  valveCommands(@Param('deviceId') deviceId: string) {
    return this.valveControlService.listCommands(deviceId);
  }
}
