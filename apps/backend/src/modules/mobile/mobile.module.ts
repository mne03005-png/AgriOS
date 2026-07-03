import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeviceControlModule } from '../device-control/device-control.module';
import { SafetyModule } from '../safety/safety.module';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';

@Module({
  imports: [AuthModule, SafetyModule, DeviceControlModule],
  controllers: [MobileController],
  providers: [MobileService]
})
export class MobileModule {}
