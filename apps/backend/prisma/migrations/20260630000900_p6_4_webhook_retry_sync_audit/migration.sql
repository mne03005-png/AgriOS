ALTER TABLE `Device`
  ADD COLUMN `bindingSource` ENUM('MANUAL', 'THINGSBOARD_ATTRIBUTE', 'THINGSBOARD_RELATION', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN';

ALTER TABLE `IoTWebhookDeadLetter`
  ADD COLUMN `retriedAt` DATETIME(3) NULL,
  ADD COLUMN `resolvedAt` DATETIME(3) NULL;

CREATE TABLE `IoTSyncAudit` (
  `id` VARCHAR(191) NOT NULL,
  `source` VARCHAR(191) NOT NULL DEFAULT 'thingsboard',
  `syncType` VARCHAR(191) NOT NULL,
  `total` INTEGER NOT NULL DEFAULT 0,
  `created` INTEGER NOT NULL DEFAULT 0,
  `updated` INTEGER NOT NULL DEFAULT 0,
  `bound` INTEGER NOT NULL DEFAULT 0,
  `unbound` INTEGER NOT NULL DEFAULT 0,
  `warnings` JSON NULL,
  `rawResult` JSON NULL,
  `startedAt` DATETIME(3) NOT NULL,
  `finishedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `IoTSyncAudit_source_syncType_idx` ON `IoTSyncAudit`(`source`, `syncType`);
CREATE INDEX `IoTSyncAudit_createdAt_idx` ON `IoTSyncAudit`(`createdAt`);
