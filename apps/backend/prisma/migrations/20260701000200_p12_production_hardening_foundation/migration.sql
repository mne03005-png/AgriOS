-- P12 production hardening foundation.
-- Adds user auth metadata, audit event storage, and richer EventLog context.

ALTER TABLE `User`
  ADD COLUMN `email` VARCHAR(191) NULL,
  ADD COLUMN `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN `lastLoginAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `User_email_key` ON `User`(`email`);
CREATE INDEX `User_status_idx` ON `User`(`status`);

ALTER TABLE `User`
  MODIFY `role` ENUM(
    'FARMER',
    'LARGE_GROWER',
    'COOPERATIVE_ADMIN',
    'DRONE_PILOT',
    'MACHINERY_PROVIDER',
    'INPUT_STORE',
    'PLATFORM_ADMIN',
    'TENANT_ADMIN',
    'FARM_MANAGER',
    'OPERATOR',
    'VIEWER'
  ) NOT NULL DEFAULT 'FARMER';

ALTER TABLE `EventLog`
  ADD COLUMN `userId` VARCHAR(191) NULL,
  ADD COLUMN `severity` VARCHAR(191) NULL,
  ADD COLUMN `ip` VARCHAR(191) NULL,
  ADD COLUMN `userAgent` VARCHAR(512) NULL,
  ADD COLUMN `requestId` VARCHAR(191) NULL;

CREATE INDEX `EventLog_userId_idx` ON `EventLog`(`userId`);
CREATE INDEX `EventLog_requestId_idx` ON `EventLog`(`requestId`);

CREATE TABLE `AuditEvent` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NULL,
  `eventType` VARCHAR(191) NOT NULL,
  `severity` ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL') NOT NULL DEFAULT 'INFO',
  `entityType` VARCHAR(191) NULL,
  `entityId` VARCHAR(191) NULL,
  `ip` VARCHAR(191) NULL,
  `userAgent` VARCHAR(512) NULL,
  `requestId` VARCHAR(191) NULL,
  `payload` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `AuditEvent_tenantId_idx` ON `AuditEvent`(`tenantId`);
CREATE INDEX `AuditEvent_userId_idx` ON `AuditEvent`(`userId`);
CREATE INDEX `AuditEvent_eventType_idx` ON `AuditEvent`(`eventType`);
CREATE INDEX `AuditEvent_severity_idx` ON `AuditEvent`(`severity`);
CREATE INDEX `AuditEvent_entityType_entityId_idx` ON `AuditEvent`(`entityType`, `entityId`);
CREATE INDEX `AuditEvent_requestId_idx` ON `AuditEvent`(`requestId`);
CREATE INDEX `AuditEvent_createdAt_idx` ON `AuditEvent`(`createdAt`);
