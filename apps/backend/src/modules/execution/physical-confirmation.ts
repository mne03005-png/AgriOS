export const PHYSICAL_CONFIRMED = 'PHYSICALLY_CONFIRMED';
export const PHYSICAL_PENDING = new Set(['PENDING', 'DISPATCHING', 'SENT', 'ACKED', 'ACK_PENDING', 'FEEDBACK_PENDING', 'OUTCOME_UNKNOWN']);
export const PHYSICAL_FAILED = new Set(['FAILED', 'REJECTED', 'FEEDBACK_MISMATCH', 'FEEDBACK_TIMEOUT', 'FEEDBACK_UNAVAILABLE']);

export function resultExecutionStatus(result: any): string {
  if (result?.physicalConfirmed === true && result?.feedback?.fake !== true) return PHYSICAL_CONFIRMED;
  if (result?.physicalConfirmed === true && result?.feedback?.fake === true) return PHYSICAL_CONFIRMED;
  if (result?.status === 'FEEDBACK_MISMATCH') return 'FEEDBACK_MISMATCH';
  if (result?.status === 'FEEDBACK_TIMEOUT' || result?.status === 'TIMEOUT') return 'FEEDBACK_TIMEOUT';
  if (result?.status === 'FEEDBACK_UNAVAILABLE') return 'FEEDBACK_UNAVAILABLE';
  if (result?.status === 'OUTCOME_UNKNOWN') return 'OUTCOME_UNKNOWN';
  if (result?.accepted === false || result?.ok === false || ['FAILED', 'REJECTED', 'SAFETY_BLOCKED'].includes(result?.status)) return 'FAILED';
  return 'FEEDBACK_PENDING';
}

export function aggregatePhysicalStatus(executions: Array<{ status: string }>) {
  if (executions.some((item) => PHYSICAL_FAILED.has(item.status))) return 'FAILED';
  if (executions.length > 0 && executions.every((item) => item.status === PHYSICAL_CONFIRMED || item.status === 'SKIPPED')) return 'CONFIRMED';
  return 'AWAITING_CONFIRMATION';
}
