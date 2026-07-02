import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { QueryFilterInterceptor } from './query-filter.interceptor';
import { TenantService } from './tenant.service';

@Module({
  controllers: [TenantController],
  providers: [TenantService, QueryFilterInterceptor],
  exports: [TenantService, QueryFilterInterceptor]
})
export class TenantModule {}
