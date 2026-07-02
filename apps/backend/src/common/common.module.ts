import { Global, Module } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { TenantContextService } from './tenant/tenant-context.service';
import { TenantGuard } from './tenant/tenant.guard';
import { PermissionsGuard } from './permissions/permissions.guard';

@Global()
@Module({
  providers: [RequestContextService, TenantContextService, TenantGuard, PermissionsGuard],
  exports: [RequestContextService, TenantContextService, TenantGuard, PermissionsGuard]
})
export class CommonModule {}
