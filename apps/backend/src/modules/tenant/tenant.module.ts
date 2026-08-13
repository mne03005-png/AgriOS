import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantController } from './tenant.controller';
import { QueryFilterInterceptor } from './query-filter.interceptor';
import { TenantService } from './tenant.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantController],
  providers: [TenantService, QueryFilterInterceptor],
  exports: [TenantService, QueryFilterInterceptor]
})
export class TenantModule {}
