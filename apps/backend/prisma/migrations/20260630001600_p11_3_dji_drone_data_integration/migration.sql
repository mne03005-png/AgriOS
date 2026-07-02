ALTER TABLE `UsageRecord` MODIFY `usageType` ENUM('DEVICE_ONLINE', 'AI_DECISION', 'IRRIGATION_ACTION', 'WATER_USAGE', 'SMS_ALERT', 'MAP_RECOGNITION', 'DRONE_OPERATION', 'DRONE_OPERATION_REPORT', 'DRONE_JOB', 'DEVICE_EXECUTION', 'DEVICE_ONLINE_DAY', 'HECTARE_MONTH') NOT NULL;

ALTER TABLE `OperationReport` MODIFY `type` ENUM('IRRIGATION', 'FERTIGATION', 'ROTATION', 'DEVICE_INSPECTION', 'ANOMALY', 'DRONE_MAPPING', 'DRONE_SPRAYING', 'DRONE_SPREADING', 'DRONE_SCOUTING') NOT NULL;

ALTER TABLE `FarmActivity` MODIFY `type` ENUM('SENSOR_ALERT', 'IRRIGATION_STARTED', 'IRRIGATION_COMPLETED', 'FERTIGATION_STARTED', 'FERTIGATION_COMPLETED', 'ROTATION_STARTED', 'ROTATION_COMPLETED', 'DRONE_OPERATION_IMPORTED', 'DRONE_SPRAYING_COMPLETED', 'DRONE_MAPPING_COMPLETED', 'DEVICE_OFFLINE', 'DEVICE_RECOVERED', 'AI_DECISION_CREATED', 'MANUAL_OPERATION') NOT NULL;

CREATE TABLE `DroneOperation` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NULL,
  `fieldBoundaryId` VARCHAR(191) NULL,
  `droneBrand` VARCHAR(191) NOT NULL DEFAULT 'DJI',
  `droneModel` VARCHAR(191) NULL,
  `operationType` ENUM('MAPPING', 'SPRAYING', 'SPREADING', 'SCOUTING', 'SEEDING') NOT NULL,
  `source` ENUM('DJI_SMARTFARM', 'DJI_TERRA', 'DJI_PILOT', 'DJI_REMOTE_CONTROLLER', 'KML', 'KMZ', 'GEOJSON', 'GEOTIFF', 'CSV', 'FLIGHT_RECORD_ZIP', 'MANUAL_IMPORT') NOT NULL,
  `sourceFileName` VARCHAR(191) NULL,
  `coordinateSystem` ENUM('WGS84', 'GCJ02', 'BD09') NULL,
  `plannedAreaMu` DOUBLE NULL,
  `actualAreaMu` DOUBLE NULL,
  `coverageRate` DOUBLE NULL,
  `overlapRate` DOUBLE NULL,
  `missedAreaMu` DOUBLE NULL,
  `repeatedAreaMu` DOUBLE NULL,
  `flightDistanceM` DOUBLE NULL,
  `flightDurationS` INTEGER NULL,
  `sprayVolumeL` DOUBLE NULL,
  `chemicalName` VARCHAR(191) NULL,
  `dosagePerMu` DOUBLE NULL,
  `routeGeoJson` JSON NULL,
  `coverageGeoJson` JSON NULL,
  `prescriptionJson` JSON NULL,
  `rawJson` JSON NULL,
  `status` ENUM('IMPORTED', 'PARSED', 'LINKED', 'REVIEWED', 'ARCHIVED') NOT NULL DEFAULT 'IMPORTED',
  `startedAt` DATETIME(3) NULL,
  `finishedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `DroneOperation_tenantId_idx`(`tenantId`),
  INDEX `DroneOperation_farmId_idx`(`farmId`),
  INDEX `DroneOperation_fieldId_idx`(`fieldId`),
  INDEX `DroneOperation_fieldBoundaryId_idx`(`fieldBoundaryId`),
  INDEX `DroneOperation_operationType_idx`(`operationType`),
  INDEX `DroneOperation_source_idx`(`source`),
  INDEX `DroneOperation_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `DroneImportJob` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NULL,
  `source` ENUM('DJI_SMARTFARM', 'DJI_TERRA', 'DJI_PILOT', 'DJI_REMOTE_CONTROLLER', 'KML', 'KMZ', 'GEOJSON', 'GEOTIFF', 'CSV', 'FLIGHT_RECORD_ZIP', 'MANUAL_IMPORT') NOT NULL,
  `fileName` VARCHAR(191) NOT NULL,
  `fileType` ENUM('DJI_SMARTFARM', 'DJI_TERRA', 'DJI_PILOT', 'DJI_REMOTE_CONTROLLER', 'KML', 'KMZ', 'GEOJSON', 'GEOTIFF', 'CSV', 'FLIGHT_RECORD_ZIP', 'MANUAL_IMPORT') NOT NULL,
  `status` ENUM('UPLOADED', 'PARSING', 'PARSED', 'FAILED') NOT NULL DEFAULT 'UPLOADED',
  `parsedJson` JSON NULL,
  `errorMessage` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `DroneImportJob_tenantId_idx`(`tenantId`),
  INDEX `DroneImportJob_farmId_idx`(`farmId`),
  INDEX `DroneImportJob_fieldId_idx`(`fieldId`),
  INDEX `DroneImportJob_source_idx`(`source`),
  INDEX `DroneImportJob_fileType_idx`(`fileType`),
  INDEX `DroneImportJob_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
