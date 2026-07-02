ALTER TABLE `SensorRecord` ADD COLUMN `normalizedJson` JSON NULL;

CREATE TABLE `DeviceTelemetrySnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NULL,
  `fieldId` VARCHAR(191) NULL,
  `deviceId` VARCHAR(191) NOT NULL,
  `thingsboardDeviceId` VARCHAR(191) NULL,
  `pressureKpa` DECIMAL(12, 3) NULL,
  `flowRateM3h` DECIMAL(12, 3) NULL,
  `valveOpeningPercent` DECIMAL(12, 3) NULL,
  `pumpFrequencyHz` DECIMAL(12, 3) NULL,
  `pumpRunningStatus` VARCHAR(191) NULL,
  `fertilizerTankLevelL` DECIMAL(12, 3) NULL,
  `waterTankLevelL` DECIMAL(12, 3) NULL,
  `batteryPercent` DECIMAL(12, 3) NULL,
  `signalStrength` DECIMAL(12, 3) NULL,
  `normalizedJson` JSON NULL,
  `rawPayload` JSON NULL,
  `reportedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `DeviceTelemetrySnapshot_deviceId_key`(`deviceId`),
  INDEX `DeviceTelemetrySnapshot_tenantId_idx`(`tenantId`),
  INDEX `DeviceTelemetrySnapshot_farmId_idx`(`farmId`),
  INDEX `DeviceTelemetrySnapshot_fieldId_idx`(`fieldId`),
  INDEX `DeviceTelemetrySnapshot_deviceId_idx`(`deviceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `IrrigationRotationGroup` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NULL,
  `irrigationDesignId` VARCHAR(191) NULL,
  `status` ENUM('ACTIVE', 'PAUSED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `targetPressureKpa` DECIMAL(12, 3) NULL,
  `targetFlowRate` DECIMAL(12, 3) NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `IrrigationRotationGroup_tenantId_idx`(`tenantId`),
  INDEX `IrrigationRotationGroup_farmId_idx`(`farmId`),
  INDEX `IrrigationRotationGroup_fieldId_idx`(`fieldId`),
  INDEX `IrrigationRotationGroup_irrigationDesignId_idx`(`irrigationDesignId`),
  INDEX `IrrigationRotationGroup_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `IrrigationRotationValve` (
  `id` VARCHAR(191) NOT NULL,
  `groupId` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NULL,
  `zoneId` VARCHAR(191) NULL,
  `valveOrder` INTEGER NOT NULL,
  `targetOpeningPercent` DECIMAL(12, 3) NULL,
  `maxIrrigationMinutes` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `IrrigationRotationValve_groupId_idx`(`groupId`),
  INDEX `IrrigationRotationValve_deviceId_idx`(`deviceId`),
  INDEX `IrrigationRotationValve_fieldId_idx`(`fieldId`),
  INDEX `IrrigationRotationValve_zoneId_idx`(`zoneId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `IrrigationRotationSchedule` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `groupId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `scheduleJson` JSON NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `IrrigationRotationSchedule_tenantId_idx`(`tenantId`),
  INDEX `IrrigationRotationSchedule_farmId_idx`(`farmId`),
  INDEX `IrrigationRotationSchedule_groupId_idx`(`groupId`),
  INDEX `IrrigationRotationSchedule_isActive_idx`(`isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `IrrigationRotationRun` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `groupId` VARCHAR(191) NOT NULL,
  `scheduleId` VARCHAR(191) NULL,
  `status` ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `actionPlanId` VARCHAR(191) NULL,
  `startedAt` DATETIME(3) NULL,
  `finishedAt` DATETIME(3) NULL,
  `resultJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `IrrigationRotationRun_tenantId_idx`(`tenantId`),
  INDEX `IrrigationRotationRun_farmId_idx`(`farmId`),
  INDEX `IrrigationRotationRun_groupId_idx`(`groupId`),
  INDEX `IrrigationRotationRun_scheduleId_idx`(`scheduleId`),
  INDEX `IrrigationRotationRun_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `IrrigationAnomalyRule` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `type` ENUM('PRESSURE_DROP', 'PRESSURE_TOO_HIGH', 'FLOW_TOO_LOW', 'FLOW_TOO_HIGH', 'VALVE_NOT_RESPONDING', 'PUMP_ABNORMAL', 'TANK_LOW_LEVEL') NOT NULL,
  `thresholdJson` JSON NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `IrrigationAnomalyRule_tenantId_idx`(`tenantId`),
  INDEX `IrrigationAnomalyRule_farmId_idx`(`farmId`),
  INDEX `IrrigationAnomalyRule_type_idx`(`type`),
  INDEX `IrrigationAnomalyRule_isActive_idx`(`isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `IrrigationAnomalyEvent` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NULL,
  `fieldId` VARCHAR(191) NULL,
  `deviceId` VARCHAR(191) NULL,
  `type` ENUM('PRESSURE_DROP', 'PRESSURE_TOO_HIGH', 'FLOW_TOO_LOW', 'FLOW_TOO_HIGH', 'VALVE_NOT_RESPONDING', 'PUMP_ABNORMAL', 'TANK_LOW_LEVEL') NOT NULL,
  `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
  `message` TEXT NOT NULL,
  `snapshotJson` JSON NULL,
  `handled` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `IrrigationAnomalyEvent_tenantId_idx`(`tenantId`),
  INDEX `IrrigationAnomalyEvent_farmId_idx`(`farmId`),
  INDEX `IrrigationAnomalyEvent_fieldId_idx`(`fieldId`),
  INDEX `IrrigationAnomalyEvent_deviceId_idx`(`deviceId`),
  INDEX `IrrigationAnomalyEvent_type_idx`(`type`),
  INDEX `IrrigationAnomalyEvent_handled_idx`(`handled`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FertilizerTank` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NULL,
  `capacityL` DECIMAL(12, 3) NULL,
  `currentLevelL` DECIMAL(12, 3) NULL,
  `fertilizerType` VARCHAR(191) NULL,
  `status` ENUM('ACTIVE', 'LOW_LEVEL', 'EMPTY', 'OFFLINE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `FertilizerTank_tenantId_idx`(`tenantId`),
  INDEX `FertilizerTank_farmId_idx`(`farmId`),
  INDEX `FertilizerTank_deviceId_idx`(`deviceId`),
  INDEX `FertilizerTank_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FertigationRecipe` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NULL,
  `cropType` VARCHAR(191) NULL,
  `cropStage` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `recipeJson` JSON NOT NULL,
  `recommendedDurationMinutes` INTEGER NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `FertigationRecipe_tenantId_idx`(`tenantId`),
  INDEX `FertigationRecipe_farmId_idx`(`farmId`),
  INDEX `FertigationRecipe_cropType_cropStage_idx`(`cropType`, `cropStage`),
  INDEX `FertigationRecipe_isActive_idx`(`isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FertigationTask` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NULL,
  `rotationGroupId` VARCHAR(191) NULL,
  `tankId` VARCHAR(191) NULL,
  `recipeId` VARCHAR(191) NULL,
  `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED', 'BLOCKED') NOT NULL DEFAULT 'DRAFT',
  `durationMinutes` INTEGER NULL,
  `targetWaterVolume` DECIMAL(12, 3) NULL,
  `targetFertilizerVolume` DECIMAL(12, 3) NULL,
  `actionPlanId` VARCHAR(191) NULL,
  `resultJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `startedAt` DATETIME(3) NULL,
  `finishedAt` DATETIME(3) NULL,
  INDEX `FertigationTask_tenantId_idx`(`tenantId`),
  INDEX `FertigationTask_farmId_idx`(`farmId`),
  INDEX `FertigationTask_fieldId_idx`(`fieldId`),
  INDEX `FertigationTask_rotationGroupId_idx`(`rotationGroupId`),
  INDEX `FertigationTask_tankId_idx`(`tankId`),
  INDEX `FertigationTask_recipeId_idx`(`recipeId`),
  INDEX `FertigationTask_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DissolveFertilizerTask` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `tankId` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `waterVolumeL` DECIMAL(12, 3) NULL,
  `fertilizerWeightKg` DECIMAL(12, 3) NULL,
  `durationMinutes` INTEGER NULL,
  `resultJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `startedAt` DATETIME(3) NULL,
  `finishedAt` DATETIME(3) NULL,
  INDEX `DissolveFertilizerTask_tenantId_idx`(`tenantId`),
  INDEX `DissolveFertilizerTask_farmId_idx`(`farmId`),
  INDEX `DissolveFertilizerTask_tankId_idx`(`tankId`),
  INDEX `DissolveFertilizerTask_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OperationReport` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `type` ENUM('IRRIGATION', 'FERTIGATION', 'ROTATION', 'DEVICE_INSPECTION', 'ANOMALY') NOT NULL,
  `refId` VARCHAR(191) NULL,
  `title` VARCHAR(191) NOT NULL,
  `summaryJson` JSON NOT NULL,
  `metricsJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `OperationReport_tenantId_idx`(`tenantId`),
  INDEX `OperationReport_farmId_idx`(`farmId`),
  INDEX `OperationReport_type_idx`(`type`),
  INDEX `OperationReport_refId_idx`(`refId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FarmActivity` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NULL,
  `type` ENUM('SENSOR_ALERT', 'IRRIGATION_STARTED', 'IRRIGATION_COMPLETED', 'FERTIGATION_STARTED', 'FERTIGATION_COMPLETED', 'ROTATION_STARTED', 'ROTATION_COMPLETED', 'DEVICE_OFFLINE', 'DEVICE_RECOVERED', 'AI_DECISION_CREATED', 'MANUAL_OPERATION') NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `refType` VARCHAR(191) NULL,
  `refId` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `FarmActivity_tenantId_idx`(`tenantId`),
  INDEX `FarmActivity_farmId_idx`(`farmId`),
  INDEX `FarmActivity_fieldId_idx`(`fieldId`),
  INDEX `FarmActivity_type_idx`(`type`),
  INDEX `FarmActivity_refType_refId_idx`(`refType`, `refId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `IrrigationRotationValve` ADD CONSTRAINT `IrrigationRotationValve_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `IrrigationRotationGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `IrrigationRotationSchedule` ADD CONSTRAINT `IrrigationRotationSchedule_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `IrrigationRotationGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `IrrigationRotationRun` ADD CONSTRAINT `IrrigationRotationRun_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `IrrigationRotationGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FertigationTask` ADD CONSTRAINT `FertigationTask_tankId_fkey` FOREIGN KEY (`tankId`) REFERENCES `FertilizerTank`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `FertigationTask` ADD CONSTRAINT `FertigationTask_recipeId_fkey` FOREIGN KEY (`recipeId`) REFERENCES `FertigationRecipe`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `DissolveFertilizerTask` ADD CONSTRAINT `DissolveFertilizerTask_tankId_fkey` FOREIGN KEY (`tankId`) REFERENCES `FertilizerTank`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
