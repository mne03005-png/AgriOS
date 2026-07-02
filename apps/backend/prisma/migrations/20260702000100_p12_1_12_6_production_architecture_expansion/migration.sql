-- P12.1-P12.6 production architecture expansion.
-- Adds installer checks, edge skeleton, explainable AI recommendations, Bluetooth maintenance logs, and role extensions.

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
    'VIEWER',
    'INSTALLER',
    'MAINTAINER'
  ) NOT NULL DEFAULT 'FARMER';

CREATE TABLE `DeviceInstallationCheck` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NULL,
  `deviceId` VARCHAR(191) NULL,
  `thingsboardDeviceId` VARCHAR(191) NULL,
  `deviceCode` VARCHAR(191) NOT NULL,
  `deviceType` VARCHAR(191) NOT NULL,
  `installerName` VARCHAR(191) NULL,
  `status` ENUM('PENDING','PASSED','FAILED','NEEDS_RECHECK') NOT NULL DEFAULT 'PENDING',
  `telemetryOk` BOOLEAN NOT NULL DEFAULT false,
  `signalOk` BOOLEAN NOT NULL DEFAULT false,
  `batteryOk` BOOLEAN NOT NULL DEFAULT false,
  `rpcTestOk` BOOLEAN NOT NULL DEFAULT false,
  `bindingOk` BOOLEAN NOT NULL DEFAULT false,
  `notes` TEXT NULL,
  `checkedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `DeviceInstallationCheck_tenantId_idx` ON `DeviceInstallationCheck`(`tenantId`);
CREATE INDEX `DeviceInstallationCheck_farmId_idx` ON `DeviceInstallationCheck`(`farmId`);
CREATE INDEX `DeviceInstallationCheck_fieldId_idx` ON `DeviceInstallationCheck`(`fieldId`);
CREATE INDEX `DeviceInstallationCheck_deviceId_idx` ON `DeviceInstallationCheck`(`deviceId`);
CREATE INDEX `DeviceInstallationCheck_thingsboardDeviceId_idx` ON `DeviceInstallationCheck`(`thingsboardDeviceId`);
CREATE INDEX `DeviceInstallationCheck_status_idx` ON `DeviceInstallationCheck`(`status`);

CREATE TABLE `EdgeGateway` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `baseUrl` VARCHAR(191) NULL,
  `status` ENUM('ONLINE','OFFLINE','DEGRADED','MAINTENANCE') NOT NULL DEFAULT 'OFFLINE',
  `lastSeenAt` DATETIME(3) NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE UNIQUE INDEX `EdgeGateway_code_key` ON `EdgeGateway`(`code`);
CREATE INDEX `EdgeGateway_tenantId_idx` ON `EdgeGateway`(`tenantId`);
CREATE INDEX `EdgeGateway_farmId_idx` ON `EdgeGateway`(`farmId`);
CREATE INDEX `EdgeGateway_status_idx` ON `EdgeGateway`(`status`);

CREATE TABLE `EdgeDeviceBinding` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `gatewayId` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NOT NULL,
  `localAddress` VARCHAR(191) NULL,
  `protocol` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `EdgeDeviceBinding_tenantId_idx` ON `EdgeDeviceBinding`(`tenantId`);
CREATE INDEX `EdgeDeviceBinding_farmId_idx` ON `EdgeDeviceBinding`(`farmId`);
CREATE INDEX `EdgeDeviceBinding_gatewayId_idx` ON `EdgeDeviceBinding`(`gatewayId`);
CREATE INDEX `EdgeDeviceBinding_deviceId_idx` ON `EdgeDeviceBinding`(`deviceId`);
CREATE UNIQUE INDEX `EdgeDeviceBinding_gatewayId_deviceId_key` ON `EdgeDeviceBinding`(`gatewayId`,`deviceId`);

CREATE TABLE `EdgeCommand` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `gatewayId` VARCHAR(191) NULL,
  `deviceId` VARCHAR(191) NULL,
  `command` VARCHAR(191) NOT NULL,
  `payload` JSON NULL,
  `status` ENUM('PENDING','SENT','ACKED','FAILED','TIMEOUT') NOT NULL DEFAULT 'PENDING',
  `requestId` VARCHAR(191) NULL,
  `resultJson` JSON NULL,
  `errorMessage` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `sentAt` DATETIME(3) NULL,
  `ackAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE UNIQUE INDEX `EdgeCommand_requestId_key` ON `EdgeCommand`(`requestId`);
CREATE INDEX `EdgeCommand_tenantId_idx` ON `EdgeCommand`(`tenantId`);
CREATE INDEX `EdgeCommand_farmId_idx` ON `EdgeCommand`(`farmId`);
CREATE INDEX `EdgeCommand_gatewayId_idx` ON `EdgeCommand`(`gatewayId`);
CREATE INDEX `EdgeCommand_deviceId_idx` ON `EdgeCommand`(`deviceId`);
CREATE INDEX `EdgeCommand_status_idx` ON `EdgeCommand`(`status`);

CREATE TABLE `AIRecommendation` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NOT NULL,
  `fieldId` VARCHAR(191) NULL,
  `type` ENUM('IRRIGATION','FERTIGATION','DEVICE_RISK','PRESSURE_FLOW','DRONE_COVERAGE','CROP_HEALTH','COST_RISK','YIELD_FACTOR','SYSTEM_SAFETY') NOT NULL,
  `severity` ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW',
  `status` ENUM('ACTIVE','DISMISSED','RESOLVED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  `title` VARCHAR(191) NOT NULL,
  `summary` TEXT NOT NULL,
  `explanation` TEXT NOT NULL,
  `evidenceJson` JSON NULL,
  `recommendedActionJson` JSON NULL,
  `source` VARCHAR(191) NOT NULL DEFAULT 'rule_pipeline',
  `confidence` DECIMAL(5,2) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `expiresAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `AIRecommendation_tenantId_idx` ON `AIRecommendation`(`tenantId`);
CREATE INDEX `AIRecommendation_farmId_idx` ON `AIRecommendation`(`farmId`);
CREATE INDEX `AIRecommendation_fieldId_idx` ON `AIRecommendation`(`fieldId`);
CREATE INDEX `AIRecommendation_type_idx` ON `AIRecommendation`(`type`);
CREATE INDEX `AIRecommendation_severity_idx` ON `AIRecommendation`(`severity`);
CREATE INDEX `AIRecommendation_status_idx` ON `AIRecommendation`(`status`);

CREATE TABLE `BluetoothSession` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NULL,
  `userId` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NULL,
  `sessionCode` VARCHAR(191) NOT NULL,
  `status` ENUM('PENDING','ACTIVE','COMPLETED','EXPIRED','REVOKED') NOT NULL DEFAULT 'PENDING',
  `allowedOperations` JSON NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE UNIQUE INDEX `BluetoothSession_sessionCode_key` ON `BluetoothSession`(`sessionCode`);
CREATE INDEX `BluetoothSession_tenantId_idx` ON `BluetoothSession`(`tenantId`);
CREATE INDEX `BluetoothSession_farmId_idx` ON `BluetoothSession`(`farmId`);
CREATE INDEX `BluetoothSession_userId_idx` ON `BluetoothSession`(`userId`);
CREATE INDEX `BluetoothSession_deviceId_idx` ON `BluetoothSession`(`deviceId`);
CREATE INDEX `BluetoothSession_status_idx` ON `BluetoothSession`(`status`);

CREATE TABLE `BluetoothOperationLog` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NULL,
  `farmId` VARCHAR(191) NULL,
  `sessionId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `deviceId` VARCHAR(191) NULL,
  `operationType` ENUM('SCAN_DEVICE','READ_DEVICE_INFO','CONFIGURE_DEVICE','BIND_DEVICE','TEST_VALVE','TEST_SENSOR','READ_STATUS','EMERGENCY_STOP','MAINTENANCE_CHECK') NOT NULL,
  `payload` JSON NULL,
  `result` JSON NULL,
  `success` BOOLEAN NOT NULL DEFAULT true,
  `errorMessage` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE INDEX `BluetoothOperationLog_tenantId_idx` ON `BluetoothOperationLog`(`tenantId`);
CREATE INDEX `BluetoothOperationLog_farmId_idx` ON `BluetoothOperationLog`(`farmId`);
CREATE INDEX `BluetoothOperationLog_sessionId_idx` ON `BluetoothOperationLog`(`sessionId`);
CREATE INDEX `BluetoothOperationLog_userId_idx` ON `BluetoothOperationLog`(`userId`);
CREATE INDEX `BluetoothOperationLog_deviceId_idx` ON `BluetoothOperationLog`(`deviceId`);
CREATE INDEX `BluetoothOperationLog_operationType_idx` ON `BluetoothOperationLog`(`operationType`);
