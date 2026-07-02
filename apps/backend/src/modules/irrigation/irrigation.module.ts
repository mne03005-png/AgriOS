import { Module } from '@nestjs/common';
import { MqttModule } from '../mqtt/mqtt.module';
import { IrrigationController } from './irrigation.controller';
import { IrrigationService } from './irrigation.service';

@Module({
  imports: [MqttModule],
  controllers: [IrrigationController],
  providers: [IrrigationService],
  exports: [IrrigationService]
})
export class IrrigationModule {}
