import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { EdgeGatewayService } from './edge-gateway.service';

@ApiTags('P12.3 Edge Gateway')
@Controller('edge-gateways')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class EdgeGatewayController {
  constructor(private readonly service: EdgeGatewayService) {}

  @Post()
  @Permissions(PERMISSIONS.EDGE_MANAGE)
  createGateway(@Body() body: any) { return this.service.createGateway(body); }

  @Get()
  @Permissions(PERMISSIONS.DEVICE_READ)
  listGateways(@Query() query: Record<string, unknown>) { return this.service.listGateways(query); }

  @Get(':id')
  @Permissions(PERMISSIONS.DEVICE_READ)
  findGateway(@Param('id') id: string) { return this.service.findGateway(id); }

  @Post('bindings')
  @Permissions(PERMISSIONS.EDGE_MANAGE)
  bindDevice(@Body() body: any) { return this.service.bindDevice(body); }

  @Get('bindings/list')
  @Permissions(PERMISSIONS.DEVICE_READ)
  listBindings(@Query() query: Record<string, unknown>) { return this.service.listBindings(query); }

  @Post('commands')
  @Permissions(PERMISSIONS.EDGE_MANAGE)
  createCommand(@Body() body: any) { return this.service.createCommand(body); }

  @Get('commands/list')
  @Permissions(PERMISSIONS.DEVICE_READ)
  listCommands(@Query() query: Record<string, unknown>) { return this.service.listCommands(query); }

  @Post('commands/:id/ack')
  @Permissions(PERMISSIONS.EDGE_MANAGE)
  ackCommand(@Param('id') id: string, @Body() body: { resultJson?: unknown }) { return this.service.ackCommand(id, body); }

  @Post('commands/:id/fail')
  @Permissions(PERMISSIONS.EDGE_MANAGE)
  failCommand(@Param('id') id: string, @Body() body: { errorMessage?: string }) { return this.service.failCommand(id, body); }
}
