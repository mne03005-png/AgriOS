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
  ANOMALY: '异常'
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
