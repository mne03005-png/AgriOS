import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantService } from './tenant.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../../common/tenant/tenant.guard';
import { PermissionsGuard } from '../../common/permissions/permissions.guard';
import { Permissions } from '../../common/permissions/permissions.decorator';
import { PERMISSIONS } from '../../common/permissions/permission.constants';

@ApiTags('P11 租户')
@Controller('tenants')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Permissions(PERMISSIONS.TENANT_MANAGE, PERMISSIONS.PLATFORM_CONTEXT)
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @ApiCreatedResponse({ description: '创建租户' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantService.create(dto);
  }

  @Get()
  @ApiOkResponse({ description: '查询租户列表' })
  findAll() {
    return this.tenantService.findAll();
  }

  @Get(':id')
  @ApiOkResponse({ description: '查询租户详情' })
  findOne(@Param('id') id: string) {
    return this.tenantService.findOne(id);
  }

  @Patch(':id')
  @ApiOkResponse({ description: '更新租户' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantService.update(id, dto);
  }
}
