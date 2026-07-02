ALTER TABLE `User` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `Farm` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `Field` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `CropSeason` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `FarmInput` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `WorkLog` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `Device` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `SensorRecord` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `IrrigationRecord` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `DeviceCommand` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `ServiceProvider` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `CostRecord` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `IrrigationAdvice` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `OperationLog` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `IoTWebhookDeadLetter` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `IoTSyncAudit` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `FieldStateSnapshot` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `DecisionRecord` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `ActionPlan` ADD COLUMN `tenantId` VARCHAR(191) NULL;
ALTER TABLE `ActionExecution` ADD COLUMN `tenantId` VARCHAR(191) NULL;

CREATE INDEX `User_tenantId_idx` ON `User`(`tenantId`);
CREATE INDEX `Farm_tenantId_idx` ON `Farm`(`tenantId`);
CREATE INDEX `Field_tenantId_idx` ON `Field`(`tenantId`);
CREATE INDEX `CropSeason_tenantId_idx` ON `CropSeason`(`tenantId`);
CREATE INDEX `FarmInput_tenantId_idx` ON `FarmInput`(`tenantId`);
CREATE INDEX `WorkLog_tenantId_idx` ON `WorkLog`(`tenantId`);
CREATE INDEX `Device_tenantId_idx` ON `Device`(`tenantId`);
CREATE INDEX `SensorRecord_tenantId_idx` ON `SensorRecord`(`tenantId`);
CREATE INDEX `IrrigationRecord_tenantId_idx` ON `IrrigationRecord`(`tenantId`);
CREATE INDEX `DeviceCommand_tenantId_idx` ON `DeviceCommand`(`tenantId`);
CREATE INDEX `ServiceProvider_tenantId_idx` ON `ServiceProvider`(`tenantId`);
CREATE INDEX `CostRecord_tenantId_idx` ON `CostRecord`(`tenantId`);
CREATE INDEX `IrrigationAdvice_tenantId_idx` ON `IrrigationAdvice`(`tenantId`);
CREATE INDEX `OperationLog_tenantId_idx` ON `OperationLog`(`tenantId`);
CREATE INDEX `IoTWebhookDeadLetter_tenantId_idx` ON `IoTWebhookDeadLetter`(`tenantId`);
CREATE INDEX `IoTSyncAudit_tenantId_idx` ON `IoTSyncAudit`(`tenantId`);
CREATE INDEX `FieldStateSnapshot_tenantId_idx` ON `FieldStateSnapshot`(`tenantId`);
CREATE INDEX `DecisionRecord_tenantId_idx` ON `DecisionRecord`(`tenantId`);
CREATE INDEX `ActionPlan_tenantId_idx` ON `ActionPlan`(`tenantId`);
CREATE INDEX `ActionExecution_tenantId_idx` ON `ActionExecution`(`tenantId`);

CREATE TABLE `Tenant` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `type` ENUM('COMPANY', 'FARM_GROUP', 'COOPERATIVE', 'FAMILY_FARM') NOT NULL DEFAULT 'FARM_GROUP',
  `status` ENUM('ACTIVE', 'SUSPENDED', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
  `remark` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SubscriptionPlan` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `monthlyPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `pricePerHectare` DECIMAL(12, 4) NOT NULL DEFAULT 0,
  `pricePerDevice` DECIMAL(12, 4) NOT NULL DEFAULT 0,
  `pricePerAiDecision` DECIMAL(12, 4) NOT NULL DEFAULT 0,
  `features` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `SubscriptionPlan_tenantId_idx` ON `SubscriptionPlan`(`tenantId`);

CREATE TABLE `BillingAccount` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `farmId` VARCHAR(191) NULL,
  `planId` VARCHAR(191) NULL,
  `status` ENUM('ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
  `balance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `BillingAccount_tenantId_idx` ON `BillingAccount`(`tenantId`);
CREATE INDEX `BillingAccount_farmId_idx` ON `BillingAccount`(`farmId`);

CREATE TABLE `UsageRecord` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `farmId` VARCHAR(191) NULL,
  `fieldId` VARCHAR(191) NULL,
  `deviceId` VARCHAR(191) NULL,
  `usageType` ENUM('AI_DECISION', 'IRRIGATION_ACTION', 'DEVICE_EXECUTION', 'DEVICE_ONLINE_DAY', 'HECTARE_MONTH') NOT NULL,
  `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1,
  `unit` VARCHAR(191) NULL,
  `costAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `metadata` JSON NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `UsageRecord_tenantId_occurredAt_idx` ON `UsageRecord`(`tenantId`, `occurredAt`);
CREATE INDEX `UsageRecord_farmId_idx` ON `UsageRecord`(`farmId`);
CREATE INDEX `UsageRecord_usageType_idx` ON `UsageRecord`(`usageType`);

CREATE TABLE `Invoice` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `accountId` VARCHAR(191) NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `status` ENUM('DRAFT', 'ISSUED', 'PAID', 'VOID') NOT NULL DEFAULT 'DRAFT',
  `periodStart` DATETIME(3) NULL,
  `periodEnd` DATETIME(3) NULL,
  `lineItems` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `Invoice_tenantId_idx` ON `Invoice`(`tenantId`);
CREATE INDEX `Invoice_accountId_idx` ON `Invoice`(`accountId`);

CREATE TABLE `CostCenter` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `farmId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `CostCenter_tenantId_idx` ON `CostCenter`(`tenantId`);
CREATE INDEX `CostCenter_farmId_idx` ON `CostCenter`(`farmId`);

CREATE TABLE `ApprovalRequest` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `targetType` VARCHAR(191) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `riskLevel` VARCHAR(191) NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `requestedBy` VARCHAR(191) NULL,
  `approvedBy` VARCHAR(191) NULL,
  `payload` JSON NULL,
  `decidedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `ApprovalRequest_tenantId_idx` ON `ApprovalRequest`(`tenantId`);
CREATE INDEX `ApprovalRequest_targetType_targetId_idx` ON `ApprovalRequest`(`targetType`, `targetId`);
CREATE INDEX `ApprovalRequest_status_idx` ON `ApprovalRequest`(`status`);

CREATE TABLE `SafetyAlert` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NULL,
  `fieldId` VARCHAR(191) NULL,
  `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
  `alertType` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `status` ENUM('OPEN', 'ACKED', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `resolvedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `SafetyAlert_tenantId_idx` ON `SafetyAlert`(`tenantId`);
CREATE INDEX `SafetyAlert_farmId_idx` ON `SafetyAlert`(`farmId`);
CREATE INDEX `SafetyAlert_fieldId_idx` ON `SafetyAlert`(`fieldId`);
CREATE INDEX `SafetyAlert_status_idx` ON `SafetyAlert`(`status`);

CREATE TABLE `DigitalTwinSnapshot` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `fieldId` VARCHAR(191) NOT NULL,
  `simulatedSoilState` JSON NULL,
  `predictedWaterUse` DECIMAL(12, 3) NULL,
  `yieldEstimate` DECIMAL(12, 3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `DigitalTwinSnapshot_tenantId_idx` ON `DigitalTwinSnapshot`(`tenantId`);
CREATE INDEX `DigitalTwinSnapshot_fieldId_createdAt_idx` ON `DigitalTwinSnapshot`(`fieldId`, `createdAt`);
