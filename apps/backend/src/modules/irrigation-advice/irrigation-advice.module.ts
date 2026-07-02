import { Module } from '@nestjs/common';
import { MqttModule } from '../mqtt/mqtt.module';
import { IrrigationAdviceController } from './irrigation-advice.controller';
import { IrrigationAdviceService } from './irrigation-advice.service';

@Module({
  imports: [MqttModule],
  controllers: [IrrigationAdviceController],
  providers: [IrrigationAdviceService],
  exports: [IrrigationAdviceService]
})
export class IrrigationAdviceModule {}
