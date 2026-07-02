import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { EdgeGatewayController } from './edge-gateway.controller';
import { EdgeGatewayService } from './edge-gateway.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [EdgeGatewayController],
  providers: [EdgeGatewayService]
})
export class EdgeGatewayModule {}
