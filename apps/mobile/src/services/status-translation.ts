// Chinese labels for backend status/severity codes confirmed in use by normal-user
// (FARMER/MANAGER) surfaces via StatusBadge (OperationsPage, AlertsPage, BoundaryReviewPage,
// CockpitPage/ManagerWorkbenchPage since UX-1C, and FieldDetailPage since UX-1D). Unknown/
// future codes fall back to the raw value rather than crash or silently disappear -- see
// translateStatusLabel().
const statusLabels: Record<string, string> = {
  NORMAL: '正常',
  RUNNING: '运行中',
  QUEUED: '等待执行',
  PENDING: '待处理',
  PENDING_APPROVAL: '需要审批',
  EXECUTED: '已执行',
  ACKED: '已确认',
  SUCCESS: '执行成功',
  FAILED: '执行失败',
  FINISHED: '已完成',
  OUTCOME_UNKNOWN: '结果待确认',
  FEEDBACK_PENDING: '等待设备反馈',
  FEEDBACK_TIMEOUT: '反馈超时',
  FEEDBACK_MISMATCH: '反馈不一致',
  OFFLINE: '离线',
  UNKNOWN: '未知',
  CANDIDATE: '待审核',
  APPROVED: '已批准',
  REJECTED: '已拒绝',
  OPEN: '待处理',
  REVIEW: '待复核',
  LOW: '轻微',
  MEDIUM: '中等',
  HIGH: '重要',
  CRITICAL: '严重',
  ANOMALY: '异常',

  // DecisionRecommendation (AI 建议卡片 / 决策解释卡片 -- CockpitPage/FieldDetailPage/AIPage)
  NO_ACTION: '无需操作',
  SHOULD_IRRIGATE: '建议灌溉',
  STOP_IRRIGATION: '建议停止灌溉',
  CHECK_DEVICE: '建议检查设备',

  // FarmActivityType (最近动态 -- CockpitPage/FarmActivityTimeline)
  SENSOR_ALERT: '传感器告警',
  IRRIGATION_STARTED: '灌溉已开始',
  IRRIGATION_COMPLETED: '灌溉已完成',
  FERTIGATION_STARTED: '水肥已开始',
  FERTIGATION_COMPLETED: '水肥已完成',
  ROTATION_STARTED: '轮灌已开始',
  ROTATION_COMPLETED: '轮灌已完成',
  DRONE_OPERATION_IMPORTED: '无人机作业已导入',
  DRONE_OPERATION_REVIEWED: '无人机作业已审核',
  DRONE_SPRAYING_COMPLETED: '无人机喷洒已完成',
  DRONE_MAPPING_COMPLETED: '无人机测绘已完成',
  DEVICE_OFFLINE: '设备离线',
  DEVICE_RECOVERED: '设备已恢复',
  AI_DECISION_CREATED: 'AI 建议已生成',

  // DroneOperationType / DroneOperationStatus / DroneOperationReviewStatus (作业页无人机分组 --
  // OperationsPage/DroneOperationsPage/DroneReviewPage)
  MAPPING: '测绘',
  SPRAYING: '喷洒',
  SPREADING: '撒播',
  SCOUTING: '巡田',
  SEEDING: '播种',
  IMPORTED: '已导入',
  PARSED: '已解析',
  LINKED: '已关联地块',
  REVIEWED: '已审核',
  ARCHIVED: '已归档',
  NEEDS_MANUAL_LINK: '需要人工关联',
  NEEDS_BOUNDARY_FIX: '需要修正边界',

  // OperationReportType (报表详情 -- OperationReportDetailPage)
  IRRIGATION: '灌溉',
  FERTIGATION: '水肥',
  ROTATION: '轮灌',
  DEVICE_INSPECTION: '设备巡检',
  DRONE_MAPPING: '无人机测绘',
  DRONE_SPRAYING: '无人机喷洒',
  DRONE_SPREADING: '无人机撒播',
  DRONE_SCOUTING: '无人机巡田',

  // Misc map layer type fallback (MiniFarmMap layer pills)
  FIELD: '地块',

  // IrrigationAnomalyType (灌溉异常 -- AlertsPage)
  PRESSURE_DROP: '压力下降',
  PRESSURE_TOO_HIGH: '压力过高',
  FLOW_TOO_LOW: '流量过低',
  FLOW_TOO_HIGH: '流量过高',
  VALVE_NOT_RESPONDING: '阀门无响应',
  PUMP_ABNORMAL: '水泵异常',
  TANK_LOW_LEVEL: '水箱液位过低'
};

export function translateStatusLabel(raw?: string | null): string {
  if (!raw) return '未知';
  return statusLabels[raw] ?? raw;
}

// UX-1I: a visual-tone counterpart to translateStatusLabel() -- maps the SAME existing status
// codes to a StatusBadge tone instead of inventing new codes or changing business meaning.
// Callers that previously hardcoded a single tone (e.g. tone="ok") for every status in a list
// regardless of actual value are the specific "vague mapping" this exists to fix (UX-1I section
// 11). Unmapped/unknown codes fall back to 'muted', never silently to 'ok'.
const statusTones: Record<string, 'ok' | 'info' | 'warn' | 'danger' | 'muted'> = {
  NORMAL: 'ok',
  RUNNING: 'info',
  QUEUED: 'muted',
  PENDING: 'warn',
  PENDING_APPROVAL: 'warn',
  EXECUTED: 'ok',
  ACKED: 'ok',
  SUCCESS: 'ok',
  FAILED: 'danger',
  FINISHED: 'ok',
  OUTCOME_UNKNOWN: 'warn',
  FEEDBACK_PENDING: 'info',
  FEEDBACK_TIMEOUT: 'warn',
  FEEDBACK_MISMATCH: 'danger',
  OFFLINE: 'muted',
  UNKNOWN: 'muted',
  CANDIDATE: 'warn',
  APPROVED: 'ok',
  REJECTED: 'danger',
  OPEN: 'warn',
  REVIEW: 'warn',
  LOW: 'ok',
  MEDIUM: 'warn',
  HIGH: 'warn',
  CRITICAL: 'danger',
  ANOMALY: 'danger'
};

export function statusTone(raw?: string | null): 'ok' | 'info' | 'warn' | 'danger' | 'muted' {
  if (!raw) return 'muted';
  return statusTones[raw] ?? 'muted';
}
