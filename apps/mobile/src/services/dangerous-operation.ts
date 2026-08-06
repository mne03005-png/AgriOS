export type DangerousOperation = 'VALVE_OPEN' | 'VALVE_CLOSE' | 'PUMP_START' | 'PUMP_STOP' | 'MANUAL_IRRIGATION' | 'EMERGENCY_STOP' | 'DISABLE_DEVICE' | 'DISABLE_USER' | 'HIGH_RISK_APPROVAL' | 'ENABLE_AUTO';

export function requestDangerousConfirmation(operation: DangerousOperation, target: string, farm: string, zone: string) {
  if (!navigator.onLine) return { ok: false, reason: '', reauthToken: '', error: '当前离线，设备操作已阻止。' };
  const accepted = window.confirm(`高风险操作：${operation}\n对象：${target}\n农场：${farm}\nZone：${zone}\n操作仍将经过后端权限、Safety 和审计。是否继续？`);
  if (!accepted) return { ok: false, reason: '', reauthToken: '', error: '操作已取消。' };
  const reason = window.prompt('请输入操作原因（必填）')?.trim() ?? '';
  if (!reason) return { ok: false, reason: '', reauthToken: '', error: '未填写原因，操作未提交。' };
  const reauthToken = window.prompt('请输入短时 re-auth token（高风险操作必填）')?.trim() ?? '';
  if (!reauthToken) return { ok: false, reason, reauthToken: '', error: '未完成重新认证，操作未提交。' };
  return { ok: true, reason, reauthToken, error: '' };
}
