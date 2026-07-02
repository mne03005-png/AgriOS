CREATE TABLE `FieldStateSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NOT NULL,
  `cropSeasonId` VARCHAR(191) NULL,
  `latestSensorRecordId` VARCHAR(191) NULL,
  `soilMoisture` DECIMAL(12, 3) NULL,
  `temperature` DECIMAL(12, 3) NULL,
  `humidity` DECIMAL(12, 3) NULL,
  `deviceOnlineCount` INTEGER NOT NULL DEFAULT 0,
  `deviceOfflineCount` INTEGER NOT NULL DEFAULT 0,
  `riskLevel` ENUM('LOW', 'NORMAL', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'NORMAL',
  `summary` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `FieldStateSnapshot_fieldId_createdAt_idx` ON `FieldStateSnapshot`(`fieldId`, `createdAt`);
CREATE INDEX `FieldStateSnapshot_cropSeasonId_idx` ON `FieldStateSnapshot`(`cropSeasonId`);

CREATE TABLE `DecisionRecord` (
  `id` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NOT NULL,
  `cropSeasonId` VARCHAR(191) NULL,
  `stateSnapshotId` VARCHAR(191) NULL,
  `decisionType` ENUM('IRRIGATION', 'DEVICE_HEALTH', 'FIELD_RISK') NOT NULL,
  `recommendation` ENUM('NO_ACTION', 'SHOULD_IRRIGATE', 'STOP_IRRIGATION', 'CHECK_DEVICE') NOT NULL,
  `confidence` DECIMAL(5, 2) NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('PROPOSED', 'PLANNED', 'EXECUTED', 'SKIPPED', 'FAILED') NOT NULL DEFAULT 'PROPOSED',
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `DecisionRecord_fieldId_createdAt_idx` ON `DecisionRecord`(`fieldId`, `createdAt`);
CREATE INDEX `DecisionRecord_cropSeasonId_idx` ON `DecisionRecord`(`cropSeasonId`);
CREATE INDEX `DecisionRecord_stateSnapshotId_idx` ON `DecisionRecord`(`stateSnapshotId`);

CREATE TABLE `ActionPlan` (
  `id` VARCHAR(191) NOT NULL,
  `decisionId` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NOT NULL,
  `status` ENUM('PLANNED', 'EXECUTING', 'EXECUTED', 'SKIPPED', 'FAILED') NOT NULL DEFAULT 'PLANNED',
  `actions` JSON NOT NULL,
  `safety` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ActionPlan_decisionId_idx` ON `ActionPlan`(`decisionId`);
CREATE INDEX `ActionPlan_fieldId_createdAt_idx` ON `ActionPlan`(`fieldId`, `createdAt`);
CREATE INDEX `ActionPlan_status_idx` ON `ActionPlan`(`status`);

CREATE TABLE `ActionExecution` (
  `id` VARCHAR(191) NOT NULL,
  `actionPlanId` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NULL,
  `command` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING', 'SENT', 'ACKED', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
  `requestId` VARCHAR(191) NULL,
  `result` JSON NULL,
  `executedAt` DATETIME(3) NULL,
  `feedbackAt` DATETIME(3) NULL,
  `feedback` JSON NULL,
  `errorMessage` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ActionExecution_actionPlanId_idx` ON `ActionExecution`(`actionPlanId`);
CREATE INDEX `ActionExecution_deviceId_idx` ON `ActionExecution`(`deviceId`);
CREATE INDEX `ActionExecution_status_idx` ON `ActionExecution`(`status`);

ALTER TABLE `ActionPlan` ADD CONSTRAINT `ActionPlan_decisionId_fkey` FOREIGN KEY (`decisionId`) REFERENCES `DecisionRecord`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ActionExecution` ADD CONSTRAINT `ActionExecution_actionPlanId_fkey` FOREIGN KEY (`actionPlanId`) REFERENCES `ActionPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
