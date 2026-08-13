import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';

@Module({
  imports: [AuthModule, MqttModule],
  controllers: [DeviceController],
  providers: [DeviceService],
  exports: [DeviceService]
})
export class DeviceModule {}
