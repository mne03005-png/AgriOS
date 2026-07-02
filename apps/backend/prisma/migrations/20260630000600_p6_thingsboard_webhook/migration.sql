ALTER TABLE `Device` ADD COLUMN `thingsboardDeviceId` VARCHAR(191) NULL;
ALTER TABLE `Device` ADD COLUMN `thingsboardAccessToken` VARCHAR(191) NULL;
ALTER TABLE `Device` ADD COLUMN `iotStatus` ENUM('ACTIVE', 'INACTIVE', 'OFFLINE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE';
CREATE UNIQUE INDEX `Device_thingsboardDeviceId_key` ON `Device`(`thingsboardDeviceId`);
CREATE INDEX `Device_thingsboardDeviceId_idx` ON `Device`(`thingsboardDeviceId`);

ALTER TABLE `SensorRecord` MODIFY `deviceId` VARCHAR(191) NULL;
ALTER TABLE `SensorRecord` MODIFY `fieldId` VARCHAR(191) NULL;
ALTER TABLE `SensorRecord` ADD COLUMN `deviceName` VARCHAR(191) NULL;
ALTER TABLE `SensorRecord` ADD COLUMN `thingsboardDeviceId` VARCHAR(191) NULL;
ALTER TABLE `SensorRecord` ADD COLUMN `soilMoisture` DECIMAL(12, 3) NULL;
ALTER TABLE `SensorRecord` ADD COLUMN `temperature` DECIMAL(12, 3) NULL;
ALTER TABLE `SensorRecord` ADD COLUMN `humidity` DECIMAL(12, 3) NULL;
ALTER TABLE `SensorRecord` ADD COLUMN `battery` DECIMAL(12, 3) NULL;
ALTER TABLE `SensorRecord` ADD COLUMN `rawPayload` JSON NULL;
ALTER TABLE `SensorRecord` ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'thingsboard';

ALTER TABLE `Device` MODIFY `type` ENUM('SOIL_SENSOR', 'WEATHER_SENSOR', 'PUMP', 'VALVE', 'FLOW_METER', 'WATER_LEVEL', 'WEATHER_STATION', 'GATEWAY', 'CAMERA', 'OTHER') NOT NULL;
ALTER TABLE `IrrigationAdvice` MODIFY `source` ENUM('MQTT', 'MANUAL_TEST', 'SYSTEM', 'THINGSBOARD', 'TELEMETRY') NOT NULL DEFAULT 'SYSTEM';
