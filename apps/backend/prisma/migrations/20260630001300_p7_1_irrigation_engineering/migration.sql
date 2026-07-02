ALTER TABLE `ActionPlan` MODIFY `status` ENUM('PLANNED','PENDING_APPROVAL','BLOCKED','EXECUTING','EXECUTED','SKIPPED','FAILED') NOT NULL DEFAULT 'PLANNED';

CREATE TABLE `IrrigationDesign` (
  `id` VARCHAR(191) NOT NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `cropType` VARCHAR(191) NOT NULL,
  `soilType` VARCHAR(191) NOT NULL,
  `designMode` ENUM('DRIP','SPRINKLER','PIVOT','MICRO_SPRAY') NOT NULL,
  `area` DECIMAL(12,2) NOT NULL,
  `rowSpacing` DECIMAL(10,3) NULL,
  `plantSpacing` DECIMAL(10,3) NULL,
  `lateralSpacing` DECIMAL(10,3) NOT NULL,
  `emitterFlowRate` DECIMAL(10,3) NOT NULL,
  `emitterSpacing` DECIMAL(10,3) NOT NULL,
  `targetFlowRate` DECIMAL(12,3) NULL,
  `targetPressure` DECIMAL(10,3) NOT NULL,
  `sourceWaterPressure` DECIMAL(10,3) NOT NULL,
  `designJson` JSON NULL,
  `status` ENUM('DRAFT','CHECKED','APPROVED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `IrrigationDesign_farmId_idx` ON `IrrigationDesign`(`farmId`);
CREATE INDEX `IrrigationDesign_fieldId_idx` ON `IrrigationDesign`(`fieldId`);
CREATE INDEX `IrrigationDesign_status_idx` ON `IrrigationDesign`(`status`);

CREATE TABLE `IrrigationDesignZone` (
  `id` VARCHAR(191) NOT NULL,
  `designId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `area` DECIMAL(12,2) NOT NULL,
  `valveDeviceId` VARCHAR(191) NULL,
  `pipeLength` DECIMAL(12,3) NOT NULL,
  `pipeDiameter` DECIMAL(10,3) NOT NULL,
  `expectedFlowRate` DECIMAL(12,3) NULL,
  `expectedPressure` DECIMAL(10,3) NULL,
  `maxIrrigationMinutes` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `IrrigationDesignZone_designId_idx` ON `IrrigationDesignZone`(`designId`);
CREATE INDEX `IrrigationDesignZone_valveDeviceId_idx` ON `IrrigationDesignZone`(`valveDeviceId`);
ALTER TABLE `IrrigationDesignZone` ADD CONSTRAINT `IrrigationDesignZone_designId_fkey` FOREIGN KEY (`designId`) REFERENCES `IrrigationDesign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `IrrigationProduct` (
  `id` VARCHAR(191) NOT NULL,
  `category` ENUM('DRIPLINE','VALVE','FILTER','PIPE','CONNECTOR','SENSOR','CONTROLLER','FERTIGATION') NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `spec` VARCHAR(191) NOT NULL,
  `unit` VARCHAR(191) NOT NULL,
  `unitPrice` DECIMAL(12,2) NULL,
  `metadataJson` JSON NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `IrrigationProduct_category_idx` ON `IrrigationProduct`(`category`);
CREATE INDEX `IrrigationProduct_isActive_idx` ON `IrrigationProduct`(`isActive`);

CREATE TABLE `IrrigationBOM` (
  `id` VARCHAR(191) NOT NULL,
  `designId` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'GENERATED',
  `totalCost` DECIMAL(12,2) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `IrrigationBOM_designId_idx` ON `IrrigationBOM`(`designId`);
ALTER TABLE `IrrigationBOM` ADD CONSTRAINT `IrrigationBOM_designId_fkey` FOREIGN KEY (`designId`) REFERENCES `IrrigationDesign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `IrrigationBOMItem` (
  `id` VARCHAR(191) NOT NULL,
  `bomId` VARCHAR(191) NOT NULL,
  `productId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `category` ENUM('DRIPLINE','VALVE','FILTER','PIPE','CONNECTOR','SENSOR','CONTROLLER','FERTIGATION') NOT NULL,
  `spec` VARCHAR(191) NOT NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `unit` VARCHAR(191) NOT NULL,
  `unitPrice` DECIMAL(12,2) NULL,
  `amount` DECIMAL(12,2) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `IrrigationBOMItem_bomId_idx` ON `IrrigationBOMItem`(`bomId`);
CREATE INDEX `IrrigationBOMItem_productId_idx` ON `IrrigationBOMItem`(`productId`);
ALTER TABLE `IrrigationBOMItem` ADD CONSTRAINT `IrrigationBOMItem_bomId_fkey` FOREIGN KEY (`bomId`) REFERENCES `IrrigationBOM`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `HydraulicCheckResult` (
  `id` VARCHAR(191) NOT NULL,
  `designId` VARCHAR(191) NOT NULL,
  `zoneId` VARCHAR(191) NULL,
  `inputJson` JSON NOT NULL,
  `resultJson` JSON NOT NULL,
  `pressureLoss` DECIMAL(10,3) NOT NULL,
  `endPressure` DECIMAL(10,3) NOT NULL,
  `flowVariation` DECIMAL(10,3) NOT NULL,
  `isPassed` BOOLEAN NOT NULL,
  `warnings` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `HydraulicCheckResult_designId_idx` ON `HydraulicCheckResult`(`designId`);
CREATE INDEX `HydraulicCheckResult_zoneId_idx` ON `HydraulicCheckResult`(`zoneId`);
ALTER TABLE `HydraulicCheckResult` ADD CONSTRAINT `HydraulicCheckResult_designId_fkey` FOREIGN KEY (`designId`) REFERENCES `IrrigationDesign`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `CropIrrigationRecipe` (
  `id` VARCHAR(191) NOT NULL,
  `cropType` VARCHAR(191) NOT NULL,
  `cropStage` VARCHAR(191) NOT NULL,
  `soilType` VARCHAR(191) NULL,
  `targetMoistureMin` DECIMAL(10,3) NOT NULL,
  `targetMoistureMax` DECIMAL(10,3) NOT NULL,
  `recommendedIrrigationMinutes` INTEGER NOT NULL,
  `maxDailyIrrigationMinutes` INTEGER NOT NULL,
  `fertigationAdvice` JSON NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `CropIrrigationRecipe_cropType_cropStage_soilType_idx` ON `CropIrrigationRecipe`(`cropType`, `cropStage`, `soilType`);
CREATE INDEX `CropIrrigationRecipe_isActive_idx` ON `CropIrrigationRecipe`(`isActive`);

CREATE TABLE `WettingSimulation` (
  `id` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NOT NULL,
  `designId` VARCHAR(191) NULL,
  `cropType` VARCHAR(191) NOT NULL,
  `soilType` VARCHAR(191) NOT NULL,
  `emitterFlowRate` DECIMAL(10,3) NOT NULL,
  `irrigationMinutes` INTEGER NOT NULL,
  `surfaceWettingRange` DECIMAL(10,3) NOT NULL,
  `rootZoneWettingRange` DECIMAL(10,3) NOT NULL,
  `deepPercolationRisk` VARCHAR(191) NOT NULL,
  `resultJson` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `WettingSimulation_fieldId_idx` ON `WettingSimulation`(`fieldId`);
CREATE INDEX `WettingSimulation_designId_idx` ON `WettingSimulation`(`designId`);
ALTER TABLE `WettingSimulation` ADD CONSTRAINT `WettingSimulation_designId_fkey` FOREIGN KEY (`designId`) REFERENCES `IrrigationDesign`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
