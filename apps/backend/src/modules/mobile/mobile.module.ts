import { Module } from '@nestjs/common';
import { DeviceControlModule } from '../device-control/device-control.module';
import { SafetyModule } from '../safety/safety.module';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';

@Module({
  imports: [SafetyModule, DeviceControlModule],
  controllers: [MobileController],
  providers: [MobileService]
})
export class MobileModule {}
