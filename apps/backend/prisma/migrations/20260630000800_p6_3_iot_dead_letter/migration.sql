CREATE TABLE `IoTWebhookDeadLetter` (
  `id` VARCHAR(191) NOT NULL,
  `source` VARCHAR(191) NOT NULL DEFAULT 'thingsboard',
  `eventType` VARCHAR(191) NOT NULL,
  `deviceName` VARCHAR(191) NULL,
  `thingsboardDeviceId` VARCHAR(191) NULL,
  `rawPayload` JSON NULL,
  `errorMessage` TEXT NOT NULL,
  `errorStack` TEXT NULL,
  `retryCount` INTEGER NOT NULL DEFAULT 0,
  `status` ENUM('PENDING', 'RETRIED', 'RESOLVED', 'IGNORED') NOT NULL DEFAULT 'PENDING',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `IoTWebhookDeadLetter_source_eventType_idx` ON `IoTWebhookDeadLetter`(`source`, `eventType`);
CREATE INDEX `IoTWebhookDeadLetter_status_createdAt_idx` ON `IoTWebhookDeadLetter`(`status`, `createdAt`);
CREATE INDEX `IoTWebhookDeadLetter_thingsboardDeviceId_idx` ON `IoTWebhookDeadLetter`(`thingsboardDeviceId`);
