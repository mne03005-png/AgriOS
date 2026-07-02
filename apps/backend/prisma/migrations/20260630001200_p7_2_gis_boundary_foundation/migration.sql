CREATE TABLE `FieldBoundary` (
  `id` VARCHAR(191) NOT NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `source` ENUM('MANUAL_DRAW','HANDHELD_GPS','DRONE_FLIGHT','DRONE_ORTHOMOSAIC','GOOGLE_MAP','AMAP','BAIDU_MAP','AI_RECOGNITION') NOT NULL,
  `coordinateSystem` ENUM('WGS84','GCJ02','BD09') NOT NULL DEFAULT 'WGS84',
  `polygon` JSON NOT NULL,
  `area` DOUBLE NULL,
  `confidence` DOUBLE NULL,
  `status` ENUM('CANDIDATE','REVIEWED','APPROVED','ARCHIVED') NOT NULL DEFAULT 'CANDIDATE',
  `rawInput` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `FieldBoundary_farmId_idx` ON `FieldBoundary`(`farmId`);
CREATE INDEX `FieldBoundary_fieldId_idx` ON `FieldBoundary`(`fieldId`);
CREATE INDEX `FieldBoundary_status_idx` ON `FieldBoundary`(`status`);

CREATE TABLE `GpsTrack` (
  `id` VARCHAR(191) NOT NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `source` VARCHAR(191) NOT NULL,
  `coordinateSystem` ENUM('WGS84','GCJ02','BD09') NOT NULL DEFAULT 'WGS84',
  `trackJson` JSON NOT NULL,
  `rawFileName` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `GpsTrack_farmId_idx` ON `GpsTrack`(`farmId`);

CREATE TABLE `DroneMapJob` (
  `id` VARCHAR(191) NOT NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `status` ENUM('UPLOADED','PROCESSING','COMPLETED','FAILED') NOT NULL DEFAULT 'UPLOADED',
  `imageCount` INTEGER NULL,
  `flightTrack` JSON NULL,
  `orthomosaicUrl` VARCHAR(191) NULL,
  `resultJson` JSON NULL,
  `errorMessage` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `DroneMapJob_farmId_idx` ON `DroneMapJob`(`farmId`);
CREATE INDEX `DroneMapJob_status_idx` ON `DroneMapJob`(`status`);

CREATE TABLE `MapLayer` (
  `id` VARCHAR(191) NOT NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `type` ENUM('FIELD','OBSTACLE','WATER','ROAD','PIPELINE','DEVICE','DRONE_ROUTE','IRRIGATION_ZONE') NOT NULL,
  `source` VARCHAR(191) NOT NULL,
  `coordinateSystem` ENUM('WGS84','GCJ02','BD09') NOT NULL DEFAULT 'WGS84',
  `geoJson` JSON NOT NULL,
  `styleJson` JSON NULL,
  `isVisible` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `MapLayer_farmId_idx` ON `MapLayer`(`farmId`);
CREATE INDEX `MapLayer_type_idx` ON `MapLayer`(`type`);

CREATE TABLE `AIRecognitionJob` (
  `id` VARCHAR(191) NOT NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `type` ENUM('FIELD_BOUNDARY','WATER_BODY','OBSTACLE','ROAD','TREE_ROW','IRRIGATION_ZONE') NOT NULL,
  `inputSource` VARCHAR(191) NOT NULL,
  `inputJson` JSON NOT NULL,
  `status` ENUM('PENDING','PROCESSING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
  `resultJson` JSON NULL,
  `confidence` DOUBLE NULL,
  `errorMessage` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `AIRecognitionJob_farmId_idx` ON `AIRecognitionJob`(`farmId`);
CREATE INDEX `AIRecognitionJob_type_idx` ON `AIRecognitionJob`(`type`);
CREATE INDEX `AIRecognitionJob_status_idx` ON `AIRecognitionJob`(`status`);
