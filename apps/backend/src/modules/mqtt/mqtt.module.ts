import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IrrigationRuleModule } from '../irrigation-rule/irrigation-rule.module';
import { MqttController } from './mqtt.controller';
import { MqttService } from './mqtt.service';

@Module({
  imports: [AuthModule, IrrigationRuleModule],
  controllers: [MqttController],
  providers: [MqttService],
  exports: [MqttService]
})
export class MqttModule {}
