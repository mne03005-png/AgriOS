import { Module } from '@nestjs/common';
import { MqttModule } from '../../mqtt/mqtt.module';
import { IotIntegrationController } from './iot-integration.controller';
import { IotIntegrationService } from './iot-integration.service';

@Module({
  imports: [MqttModule],
  controllers: [IotIntegrationController],
  providers: [IotIntegrationService],
  exports: [IotIntegrationService]
})
export class IotIntegrationModule {}
