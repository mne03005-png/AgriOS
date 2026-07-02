CREATE TABLE `IrrigationAdvice` (
  `id` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NULL,
  `cropSeasonId` VARCHAR(191) NULL,
  `soilMoisture` DECIMAL(12, 3) NOT NULL,
  `action` ENUM('SHOULD_IRRIGATE', 'NORMAL', 'STOP_IRRIGATION') NOT NULL,
  `message` VARCHAR(191) NOT NULL,
  `source` ENUM('MQTT', 'MANUAL_TEST', 'SYSTEM') NOT NULL DEFAULT 'SYSTEM',
  `status` ENUM('PENDING', 'CONFIRMED', 'IGNORED', 'EXECUTED') NOT NULL DEFAULT 'PENDING',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OperationLog` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `action` VARCHAR(191) NOT NULL,
  `targetType` VARCHAR(191) NOT NULL,
  `targetId` VARCHAR(191) NOT NULL,
  `description` TEXT NOT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `IrrigationAdvice_fieldId_createdAt_idx` ON `IrrigationAdvice`(`fieldId`, `createdAt`);
CREATE INDEX `IrrigationAdvice_deviceId_idx` ON `IrrigationAdvice`(`deviceId`);
CREATE INDEX `IrrigationAdvice_cropSeasonId_idx` ON `IrrigationAdvice`(`cropSeasonId`);
CREATE INDEX `OperationLog_targetType_targetId_idx` ON `OperationLog`(`targetType`, `targetId`);
CREATE INDEX `OperationLog_createdAt_idx` ON `OperationLog`(`createdAt`);

ALTER TABLE `IrrigationAdvice` ADD CONSTRAINT `IrrigationAdvice_fieldId_fkey` FOREIGN KEY (`fieldId`) REFERENCES `Field`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `IrrigationAdvice` ADD CONSTRAINT `IrrigationAdvice_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `IrrigationAdvice` ADD CONSTRAINT `IrrigationAdvice_cropSeasonId_fkey` FOREIGN KEY (`cropSeasonId`) REFERENCES `CropSeason`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
