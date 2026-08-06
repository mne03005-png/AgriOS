export const PERMISSIONS = {
  MOBILE_READ: 'mobile.read',
  DEVICE_READ: 'device.read',
  DEVICE_MANAGE: 'device.manage',
  IRRIGATION_READ: 'irrigation.read',
  IRRIGATION_EXECUTE: 'irrigation.execute',
  FERTIGATION_EXECUTE: 'fertigation.execute',
  DRONE_READ: 'drone.read',
  DRONE_REVIEW: 'drone.review',
  REPORT_READ: 'report.read',
  COST_READ: 'cost.read',
  AI_READ: 'ai.read',
  SAFETY_MANAGE: 'safety.manage',
  APPROVAL_APPROVE: 'approval.approve',
  ACTION_EXECUTE: 'action.execute',
  ACTION_CANCEL: 'action.cancel',
  EDGE_MANAGE: 'edge.manage',
  BLUETOOTH_MAINTAIN: 'bluetooth.maintain',
  INSTALLER_CHECK: 'installer.check',
  AUDIT_READ: 'audit.read',
  BILLING_MANAGE: 'billing.manage',
  TENANT_MANAGE: 'tenant.manage',
  USER_MANAGE: 'user.manage',
  EMERGENCY_STOP: 'emergency.stop'
  ,PLATFORM_CONTEXT: 'platform.context'
  ,INTEGRATION_READ: 'integration.read'
  ,DIAGNOSTICS_READ: 'diagnostics.read'
  ,USER_DISABLE: 'user.disable'
  ,DEVICE_DISABLE: 'device.disable'
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
