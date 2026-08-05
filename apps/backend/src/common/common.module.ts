import { Global, Module } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { TenantContextService } from './tenant/tenant-context.service';
import { TenantGuard } from './tenant/tenant.guard';
import { PermissionsGuard } from './permissions/permissions.guard';
import { TenantScopeService } from './tenant/tenant-scope.service';

@Global()
@Module({
  providers: [RequestContextService, TenantContextService, TenantGuard, TenantScopeService, PermissionsGuard],
  exports: [RequestContextService, TenantContextService, TenantGuard, TenantScopeService, PermissionsGuard]
})
export class CommonModule {}
