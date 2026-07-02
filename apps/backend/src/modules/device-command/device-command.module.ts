import { Module } from '@nestjs/common';
import { DeviceCommandController } from './device-command.controller';
import { DeviceCommandService } from './device-command.service';

@Module({
  controllers: [DeviceCommandController],
  providers: [DeviceCommandService],
  exports: [DeviceCommandService]
})
export class DeviceCommandModule {}
