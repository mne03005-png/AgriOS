ALTER TABLE `User` ADD COLUMN `passwordHash` VARCHAR(191) NULL;

ALTER TABLE `IrrigationRecord` ADD COLUMN `status` ENUM('RUNNING', 'FINISHED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'RUNNING';

CREATE TABLE `DeviceCommand` (
  `id` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NOT NULL,
  `command` VARCHAR(191) NOT NULL,
  `payload` JSON NULL,
  `status` ENUM('PENDING', 'SENT', 'ACKED', 'FAILED', 'TIMEOUT') NOT NULL DEFAULT 'PENDING',
  `mqttTopic` VARCHAR(191) NOT NULL,
  `requestId` VARCHAR(191) NOT NULL,
  `sentAt` DATETIME(3) NULL,
  `ackAt` DATETIME(3) NULL,
  `errorMessage` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `DeviceCommand_requestId_key`(`requestId`),
  INDEX `DeviceCommand_deviceId_createdAt_idx`(`deviceId`, `createdAt`),
  INDEX `DeviceCommand_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `DeviceCommand` ADD CONSTRAINT `DeviceCommand_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
