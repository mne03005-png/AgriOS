import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeviceCommandController } from './device-command.controller';
import { DeviceCommandService } from './device-command.service';

@Module({
  imports: [AuthModule],
  controllers: [DeviceCommandController],
  providers: [DeviceCommandService],
  exports: [DeviceCommandService]
})
export class DeviceCommandModule {}
