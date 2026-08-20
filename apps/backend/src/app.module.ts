import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CommonModule } from './common/common.module';
import { AppConfigModule } from './config/app-config.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { AiDecisionModule } from './modules/ai-decision/ai-decision.module';
import { AiRecommendationModule } from './modules/ai-recommendation/ai-recommendation.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { ActionQueueModule } from './modules/action-queue/action-queue.module';
import { BillingModule } from './modules/billing/billing.module';
import { BluetoothModule } from './modules/bluetooth/bluetooth.module';
import { CostModule } from './modules/cost/cost.module';
import { CropSeasonModule } from './modules/crop-season/crop-season.module';
import { CropRecipeModule } from './modules/crop-recipe/crop-recipe.module';
import { CropHealthModule } from './modules/crop-health/crop-health.module';
import { DeviceModule } from './modules/device/device.module';
import { DeviceCommandModule } from './modules/device-command/device-command.module';
import { DeviceControlModule } from './modules/device-control/device-control.module';
import { DecisionModule } from './modules/decision/decision.module';
import { DecisionEngineModule } from './modules/decision-engine/decision-engine.module';
import { DemoModule } from './modules/demo/demo.module';
import { DigitalTwinModule } from './modules/digital-twin/digital-twin.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DroneOperationModule } from './modules/drone-operation/drone-operation.module';
import { DroneReviewModule } from './modules/drone-review/drone-review.module';
import { EdgeGatewayModule } from './modules/edge-gateway/edge-gateway.module';
import { EventBusModule } from './modules/event-bus/event-bus.module';
import { ExecutionModule } from './modules/execution/execution.module';
import { FarmInputModule } from './modules/farm-input/farm-input.module';
import { FarmModule } from './modules/farm/farm.module';
import { FarmActivityModule } from './modules/farm-activity/farm-activity.module';
import { FertigationModule } from './modules/fertigation/fertigation.module';
import { FileSecurityModule } from './modules/file-security/file-security.module';
import { FieldModule } from './modules/field/field.module';
import { GisModule } from './modules/gis/gis.module';
import { HealthModule } from './modules/health/health.module';
import { IrrigationModule } from './modules/irrigation/irrigation.module';
import { InstallerModule } from './modules/installer/installer.module';
import { IrrigationAdviceModule } from './modules/irrigation-advice/irrigation-advice.module';
import { IrrigationDesignModule } from './modules/irrigation-design/irrigation-design.module';
import { IrrigationMonitoringModule } from './modules/irrigation-monitoring/irrigation-monitoring.module';
import { IrrigationRotationModule } from './modules/irrigation-rotation/irrigation-rotation.module';
import { IrrigationRuleModule } from './modules/irrigation-rule/irrigation-rule.module';
import { IotModule } from './modules/iot/iot.module';
import { IotIntegrationModule } from './modules/iot/integration/iot-integration.module';
import { MqttModule } from './modules/mqtt/mqtt.module';
import { MobileModule } from './modules/mobile/mobile.module';
import { OpenAgriosModule } from './modules/open-agrios/open-agrios.module';
import { OperationLogModule } from './modules/operation-log/operation-log.module';
import { OperationCostModule } from './modules/operation-cost/operation-cost.module';
import { OperationReportModule } from './modules/operation-report/operation-report.module';
import { ReportModule } from './modules/report/report.module';
import { PrismaModule } from './prisma/prisma.module';
import { SafetyModule } from './modules/safety/safety.module';
import { SensorRecordModule } from './modules/sensor-record/sensor-record.module';
import { ServiceProviderModule } from './modules/service-provider/service-provider.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UserModule } from './modules/user/user.module';
import { WorkLogModule } from './modules/work-log/work-log.module';
import { WettingSimulationModule } from './modules/wetting-simulation/wetting-simulation.module';
import { YieldAnalysisModule } from './modules/yield-analysis/yield-analysis.module';

@Module({
  imports: [
    AppConfigModule,
    CommonModule,
    PrismaModule,
    EventBusModule,
    AuditModule,
    OperationLogModule,
    ActionQueueModule,
    TenantModule,
    BillingModule,
    BluetoothModule,
    SafetyModule,
    ApprovalModule,
    DeviceControlModule,
    ExecutionModule,
    AiDecisionModule,
    AiRecommendationModule,
    DigitalTwinModule,
    DashboardModule,
    DemoModule,
    HealthModule,
    FileSecurityModule,
    OperationCostModule,
    CropHealthModule,
    YieldAnalysisModule,
    DroneReviewModule,
    EdgeGatewayModule,
    DroneOperationModule,
    IotIntegrationModule,
    AuthModule,
    UserModule,
    FarmModule,
    FarmActivityModule,
    FertigationModule,
    FieldModule,
    GisModule,
    CropSeasonModule,
    FarmInputModule,
    WorkLogModule,
    DeviceModule,
    DeviceCommandModule,
    DecisionModule,
    DecisionEngineModule,
    SensorRecordModule,
    InstallerModule,
    IrrigationModule,
    IrrigationAdviceModule,
    IrrigationDesignModule,
    IrrigationMonitoringModule,
    IrrigationRotationModule,
    IrrigationRuleModule,
    CropRecipeModule,
    WettingSimulationModule,
    IotModule,
    ServiceProviderModule,
    CostModule,
    MqttModule,
    MobileModule,
    OpenAgriosModule,
    OperationReportModule,
    ReportModule
  ],
  controllers: [AppController]
})
export class AppModule {}
