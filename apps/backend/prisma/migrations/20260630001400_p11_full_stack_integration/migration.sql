ALTER TABLE `Tenant`
  ADD COLUMN `metadata` JSON NULL,
  MODIFY `type` ENUM('FARM_OWNER','COOP','ENTERPRISE','GOVERNMENT','DEMO','COMPANY','FARM_GROUP','COOPERATIVE','FAMILY_FARM') NOT NULL DEFAULT 'FARM_GROUP',
  MODIFY `status` ENUM('ACTIVE','SUSPENDED','ARCHIVED','CLOSED') NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE `TenantFarm` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `TenantFarm_tenantId_idx` ON `TenantFarm`(`tenantId`);
CREATE INDEX `TenantFarm_farmId_idx` ON `TenantFarm`(`farmId`);
CREATE UNIQUE INDEX `TenantFarm_tenantId_farmId_key` ON `TenantFarm`(`tenantId`, `farmId`);

ALTER TABLE `UsageRecord`
  MODIFY `usageType` ENUM('DEVICE_ONLINE','AI_DECISION','IRRIGATION_ACTION','WATER_USAGE','SMS_ALERT','MAP_RECOGNITION','DRONE_JOB','DEVICE_EXECUTION','DEVICE_ONLINE_DAY','HECTARE_MONTH') NOT NULL;

ALTER TABLE `Invoice`
  MODIFY `status` ENUM('DRAFT','ISSUED','PAID','CANCELLED','VOID') NOT NULL DEFAULT 'DRAFT';

ALTER TABLE `ApprovalRequest`
  ADD COLUMN `farmId` VARCHAR(191) NULL,
  ADD COLUMN `fieldId` VARCHAR(191) NULL,
  ADD COLUMN `actionPlanId` VARCHAR(191) NULL,
  ADD COLUMN `decisionRecordId` VARCHAR(191) NULL,
  ADD COLUMN `type` ENUM('ACTION_PLAN','AUTO_EXECUTION','HIGH_RISK_DECISION','MANUAL_OVERRIDE') NOT NULL DEFAULT 'ACTION_PLAN',
  ADD COLUMN `reason` TEXT NULL,
  ADD COLUMN `approvedAt` DATETIME(3) NULL,
  ADD COLUMN `rejectedAt` DATETIME(3) NULL,
  MODIFY `status` ENUM('PENDING','APPROVED','REJECTED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'PENDING';
CREATE INDEX `ApprovalRequest_farmId_idx` ON `ApprovalRequest`(`farmId`);
CREATE INDEX `ApprovalRequest_fieldId_idx` ON `ApprovalRequest`(`fieldId`);
CREATE INDEX `ApprovalRequest_actionPlanId_idx` ON `ApprovalRequest`(`actionPlanId`);
CREATE INDEX `ApprovalRequest_decisionRecordId_idx` ON `ApprovalRequest`(`decisionRecordId`);

ALTER TABLE `FieldBoundary`
  ADD COLUMN `tenantId` VARCHAR(191) NULL,
  ADD COLUMN `areaSquareMeters` DOUBLE NULL,
  ADD COLUMN `areaMu` DOUBLE NULL;
CREATE INDEX `FieldBoundary_tenantId_idx` ON `FieldBoundary`(`tenantId`);

ALTER TABLE `GpsTrack` ADD COLUMN `tenantId` VARCHAR(191) NULL;
CREATE INDEX `GpsTrack_tenantId_idx` ON `GpsTrack`(`tenantId`);

ALTER TABLE `DroneMapJob` ADD COLUMN `tenantId` VARCHAR(191) NULL;
CREATE INDEX `DroneMapJob_tenantId_idx` ON `DroneMapJob`(`tenantId`);

ALTER TABLE `MapLayer`
  ADD COLUMN `tenantId` VARCHAR(191) NULL,
  MODIFY `type` ENUM('FIELD','OBSTACLE','WATER','ROAD','PIPELINE','DEVICE','DRONE_ROUTE','IRRIGATION_ZONE','ORTHOMOSAIC') NOT NULL;
CREATE INDEX `MapLayer_tenantId_idx` ON `MapLayer`(`tenantId`);

ALTER TABLE `AIRecognitionJob` ADD COLUMN `tenantId` VARCHAR(191) NULL;
CREATE INDEX `AIRecognitionJob_tenantId_idx` ON `AIRecognitionJob`(`tenantId`);

ALTER TABLE `IrrigationDesign`
  ADD COLUMN `tenantId` VARCHAR(191) NULL,
  ADD COLUMN `fieldBoundaryId` VARCHAR(191) NULL,
  ADD COLUMN `areaMu` DOUBLE NULL,
  MODIFY `area` DECIMAL(12,2) NULL,
  MODIFY `lateralSpacing` DECIMAL(10,3) NULL,
  MODIFY `emitterFlowRate` DECIMAL(10,3) NULL,
  MODIFY `emitterSpacing` DECIMAL(10,3) NULL,
  MODIFY `targetPressure` DECIMAL(10,3) NULL,
  MODIFY `sourceWaterPressure` DECIMAL(10,3) NULL;
CREATE INDEX `IrrigationDesign_tenantId_idx` ON `IrrigationDesign`(`tenantId`);
CREATE INDEX `IrrigationDesign_fieldBoundaryId_idx` ON `IrrigationDesign`(`fieldBoundaryId`);

ALTER TABLE `CropIrrigationRecipe`
  ADD COLUMN `tenantId` VARCHAR(191) NULL,
  MODIFY `maxDailyIrrigationMinutes` INTEGER NULL;
CREATE INDEX `CropIrrigationRecipe_tenantId_idx` ON `CropIrrigationRecipe`(`tenantId`);

ALTER TABLE `WettingSimulation`
  ADD COLUMN `tenantId` VARCHAR(191) NULL,
  ADD COLUMN `farmId` VARCHAR(191) NULL,
  MODIFY `surfaceWettingRange` DECIMAL(10,3) NULL,
  MODIFY `rootZoneWettingRange` DECIMAL(10,3) NULL,
  MODIFY `deepPercolationRisk` ENUM('LOW','MEDIUM','HIGH') NOT NULL,
  MODIFY `resultJson` JSON NULL;
CREATE INDEX `WettingSimulation_tenantId_idx` ON `WettingSimulation`(`tenantId`);
CREATE INDEX `WettingSimulation_farmId_idx` ON `WettingSimulation`(`farmId`);

CREATE TABLE `SafetyPolicy` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NULL,
  `fieldId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `maxIrrigationMinutesPerAction` INTEGER NULL,
  `maxDailyIrrigationMinutesPerField` INTEGER NULL,
  `maxDailyWaterUsage` DOUBLE NULL,
  `allowAutoExecution` BOOLEAN NOT NULL DEFAULT false,
  `requireApprovalRiskLevel` VARCHAR(191) NULL,
  `emergencyStopEnabled` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `SafetyPolicy_tenantId_idx` ON `SafetyPolicy`(`tenantId`);
CREATE INDEX `SafetyPolicy_farmId_idx` ON `SafetyPolicy`(`farmId`);
CREATE INDEX `SafetyPolicy_fieldId_idx` ON `SafetyPolicy`(`fieldId`);
CREATE INDEX `SafetyPolicy_isActive_idx` ON `SafetyPolicy`(`isActive`);

CREATE TABLE `AutoExecutionPolicy` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NULL,
  `deviceId` VARCHAR(191) NULL,
  `isWhitelisted` BOOLEAN NOT NULL DEFAULT false,
  `maxRiskLevel` VARCHAR(191) NULL,
  `allowedActionTypes` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `AutoExecutionPolicy_tenantId_idx` ON `AutoExecutionPolicy`(`tenantId`);
CREATE INDEX `AutoExecutionPolicy_farmId_idx` ON `AutoExecutionPolicy`(`farmId`);
CREATE INDEX `AutoExecutionPolicy_fieldId_idx` ON `AutoExecutionPolicy`(`fieldId`);
CREATE INDEX `AutoExecutionPolicy_deviceId_idx` ON `AutoExecutionPolicy`(`deviceId`);

CREATE TABLE `ActionQueueJob` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `actionPlanId` VARCHAR(191) NOT NULL,
  `actionExecutionId` VARCHAR(191) NULL,
  `status` ENUM('PENDING','QUEUED','EXECUTING','SUCCESS','FAILED','RETRYING','DEAD_LETTERED') NOT NULL DEFAULT 'PENDING',
  `retryCount` INTEGER NOT NULL DEFAULT 0,
  `maxRetries` INTEGER NOT NULL DEFAULT 3,
  `lastError` TEXT NULL,
  `scheduledAt` DATETIME(3) NULL,
  `startedAt` DATETIME(3) NULL,
  `finishedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `ActionQueueJob_tenantId_idx` ON `ActionQueueJob`(`tenantId`);
CREATE INDEX `ActionQueueJob_farmId_idx` ON `ActionQueueJob`(`farmId`);
CREATE INDEX `ActionQueueJob_actionPlanId_idx` ON `ActionQueueJob`(`actionPlanId`);
CREATE INDEX `ActionQueueJob_status_idx` ON `ActionQueueJob`(`status`);

CREATE TABLE `EventLog` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NULL,
  `eventType` VARCHAR(191) NOT NULL,
  `entityType` VARCHAR(191) NULL,
  `entityId` VARCHAR(191) NULL,
  `payload` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `EventLog_tenantId_idx` ON `EventLog`(`tenantId`);
CREATE INDEX `EventLog_farmId_idx` ON `EventLog`(`farmId`);
CREATE INDEX `EventLog_eventType_idx` ON `EventLog`(`eventType`);
CREATE INDEX `EventLog_entityType_entityId_idx` ON `EventLog`(`entityType`, `entityId`);
