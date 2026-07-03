ALTER TABLE `User`
  ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `passwordChangedAt` DATETIME(3) NULL,
  ADD COLUMN `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `lockedUntil` DATETIME(3) NULL;

CREATE INDEX `User_lockedUntil_idx` ON `User`(`lockedUntil`);
