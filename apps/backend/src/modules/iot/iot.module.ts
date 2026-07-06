import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IrrigationMonitoringModule } from '../irrigation-monitoring/irrigation-monitoring.module';
import { IrrigationRuleModule } from '../irrigation-rule/irrigation-rule.module';
import { IotController } from './iot.controller';
import { IotDeviceService } from './iot-device.service';
import { IotSyncAuditService } from './iot-sync-audit.service';
import { IotTelemetryNormalizerService } from './iot-telemetry-normalizer.service';
import { IotWebhookDeadLetterService } from './iot-webhook-dead-letter.service';
import { ThingsBoardClientService } from './thingsboard-client.service';
import { ThingsBoardWebhookService } from './thingsboard-webhook.service';

@Module({
  imports: [AuthModule, IrrigationRuleModule, IrrigationMonitoringModule],
  controllers: [IotController],
  providers: [IotDeviceService, IotSyncAuditService, IotTelemetryNormalizerService, IotWebhookDeadLetterService, ThingsBoardClientService, ThingsBoardWebhookService],
  exports: [IotDeviceService, IotSyncAuditService, IotTelemetryNormalizerService, IotWebhookDeadLetterService, ThingsBoardClientService, ThingsBoardWebhookService]
})
export class IotModule {}
