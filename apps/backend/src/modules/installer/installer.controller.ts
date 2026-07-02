import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';
import { InstallerService } from './installer.service';

@ApiTags('P12.2 Installer Checks')
@Controller('installer/device-checks')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Permissions(PERMISSIONS.INSTALLER_CHECK)
export class InstallerController {
  constructor(private readonly service: InstallerService) {}

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Get()
  list(@Query() query: Record<string, unknown>) { return this.service.list(query); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @Post(':id/mark-passed')
  markPassed(@Param('id') id: string) { return this.service.markPassed(id); }

  @Post(':id/mark-failed')
  markFailed(@Param('id') id: string, @Body() body: { notes?: string }) { return this.service.markFailed(id, body); }

  @Post(':id/link-agrios-device')
  linkAgriosDevice(@Param('id') id: string, @Body() body: { deviceId: string }) { return this.service.linkAgriosDevice(id, body); }
}
