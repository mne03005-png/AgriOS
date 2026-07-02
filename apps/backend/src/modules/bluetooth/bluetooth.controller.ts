import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { BluetoothService } from './bluetooth.service';

@ApiTags('P12.5 Bluetooth Maintenance')
@Controller('bluetooth')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Permissions(PERMISSIONS.BLUETOOTH_MAINTAIN)
export class BluetoothController {
  constructor(private readonly service: BluetoothService) {}

  @Post('sessions')
  createSession(@Body() body: any) { return this.service.createSession(body); }

  @Get('sessions')
  listSessions(@Query() query: Record<string, unknown>) { return this.service.listSessions(query); }

  @Get('sessions/:id')
  findSession(@Param('id') id: string) { return this.service.findSession(id); }

  @Post('sessions/:id/complete')
  complete(@Param('id') id: string) { return this.service.complete(id); }

  @Post('sessions/:id/revoke')
  revoke(@Param('id') id: string) { return this.service.revoke(id); }

  @Post('sessions/:id/operation-logs')
  addOperationLog(@Param('id') id: string, @Body() body: any) { return this.service.addOperationLog(id, body); }

  @Get('sessions/:id/operation-logs')
  listOperationLogs(@Param('id') id: string) { return this.service.listOperationLogs(id); }
}
