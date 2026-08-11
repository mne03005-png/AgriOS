import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';
import { DeviceControlModule } from '../device-control/device-control.module';
import { OperationLogModule } from '../operation-log/operation-log.module';

@Module({
  imports: [AuthModule, DeviceControlModule, OperationLogModule],
  controllers: [SafetyController],
  providers: [SafetyService],
  exports: [SafetyService]
})
export class SafetyModule {}
