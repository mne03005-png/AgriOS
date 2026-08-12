// Chinese labels for backend status/severity codes confirmed in use by normal-user
// (FARMER/MANAGER) surfaces via StatusBadge (OperationsPage, AlertsPage, BoundaryReviewPage,
// and since UX-1C, CockpitPage/ManagerWorkbenchPage). Unknown/future codes fall back to the
// raw value rather than crash or silently disappear -- see translateStatusLabel().
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
  OUTCOME_UNKNOWN: '结果待确认',
  FEEDBACK_PENDING: '等待设备反馈',
  FEEDBACK_TIMEOUT: '反馈超时',
  FEEDBACK_MISMATCH: '反馈不一致',
  OFFLINE: '离线',
  UNKNOWN: '未知',
  CANDIDATE: '待审核',
  APPROVED: '已批准',
  REJECTED: '已拒绝',
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
