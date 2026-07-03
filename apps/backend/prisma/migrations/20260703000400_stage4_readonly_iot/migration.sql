ALTER TABLE `SensorRecord`
  ADD COLUMN `farmId` VARCHAR(191) NULL,
  ADD COLUMN `eventId` VARCHAR(191) NULL,
  ADD COLUMN `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `qualityStatus` ENUM('GOOD','WARNING','INVALID','STALE','DUPLICATE','CLOCK_DRIFT') NOT NULL DEFAULT 'GOOD',
  ADD COLUMN `qualityScore` INTEGER NOT NULL DEFAULT 100;

CREATE UNIQUE INDEX `SensorRecord_eventId_key` ON `SensorRecord`(`eventId`);
CREATE INDEX `SensorRecord_farmId_idx` ON `SensorRecord`(`farmId`);
CREATE INDEX `SensorRecord_qualityStatus_idx` ON `SensorRecord`(`qualityStatus`);
CREATE INDEX `SensorRecord_receivedAt_idx` ON `SensorRecord`(`receivedAt`);

ALTER TABLE `IoTWebhookDeadLetter`
  ADD COLUMN `originalSource` VARCHAR(191) NULL,
  ADD COLUMN `eventId` VARCHAR(191) NULL;

CREATE INDEX `IoTWebhookDeadLetter_eventId_idx` ON `IoTWebhookDeadLetter`(`eventId`);

ALTER TABLE `DeviceTelemetrySnapshot`
  ADD COLUMN `soilMoisture` DECIMAL(12, 3) NULL,
  ADD COLUMN `soilTemperature` DECIMAL(12, 3) NULL,
  ADD COLUMN `airTemperature` DECIMAL(12, 3) NULL,
  ADD COLUMN `airHumidity` DECIMAL(12, 3) NULL,
  ADD COLUMN `lightLux` DECIMAL(12, 3) NULL,
  ADD COLUMN `co2Ppm` DECIMAL(12, 3) NULL,
  ADD COLUMN `waterLevel` DECIMAL(12, 3) NULL,
  ADD COLUMN `gatewayOnline` BOOLEAN NULL,
  ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'thingsboard',
  ADD COLUMN `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `qualityStatus` ENUM('GOOD','WARNING','INVALID','STALE','DUPLICATE','CLOCK_DRIFT') NOT NULL DEFAULT 'GOOD',
  ADD COLUMN `qualityScore` INTEGER NOT NULL DEFAULT 100;

CREATE INDEX `DeviceTelemetrySnapshot_qualityStatus_idx` ON `DeviceTelemetrySnapshot`(`qualityStatus`);
CREATE INDEX `DeviceTelemetrySnapshot_receivedAt_idx` ON `DeviceTelemetrySnapshot`(`receivedAt`);
