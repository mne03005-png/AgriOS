export type ApiError = {
  errorCode: string;
  message: string;
  reasons: string[];
  requestId?: string;
  statusCode?: number;
  actionPlanId?: string;
  commandId?: string;
  queueJobId?: string;
  deviceId?: string;
};

const userMessages: Record<string, string> = {
  EMERGENCY_STOP_ACTIVE: '急停已激活，当前禁止执行该操作。',
  REAL_CONTROL_DISABLED: '真实设备控制当前未启用。',
  APPROVAL_REQUIRED: '当前操作需要人工审批。',
  APPROVAL_RELEASE_NOT_IMPLEMENTED: '真实控制审批放行流程尚未启用。',
  VALVE_FEEDBACK_REQUIRED: '缺少阀门反馈，当前操作已被阻止。',
  VALVE_OFFLINE: '阀门设备当前离线。',
  FEEDBACK_TIMEOUT: '设备执行反馈超时，请检查设备和网络连接。',
  FEEDBACK_MISMATCH: '设备实际反馈与预期状态不一致。',
  OUTCOME_UNKNOWN: '设备执行结果暂时无法确认，请勿重复操作并等待人工核查。',
  AUTO_EXECUTION_REQUIRES_APPROVAL: '自动执行需要人工审批。',
  PERMISSION_DENIED: '当前账号没有执行该操作的权限。',
  TENANT_ID_REQUIRED: '缺少租户上下文，请重新登录后再试。',
  SAFETY_BLOCKED: '当前操作被安全策略阻止。',
  VALIDATION_ERROR: '请求参数不正确，请检查后重试。',
  NETWORK_ERROR: '网络连接失败，请检查网络后重试。',
  REQUEST_TIMEOUT: '请求超时，请稍后重试。',
  INVALID_SERVER_RESPONSE: '服务器返回了无法识别的响应。',
  HTTP_401: '登录状态已失效，请重新登录。',
  HTTP_403: '当前账号没有执行该操作的权限。',
  INTERNAL_ERROR: '服务暂时不可用，请稍后重试。'
};

const diagnosticKeys = ['actionPlanId', 'commandId', 'queueJobId', 'deviceId'] as const;

export function parseApiError(input: { status?: number; body?: unknown; text?: string; error?: unknown }): ApiError {
  try {
    const body = input.body && typeof input.body === 'object' && !Array.isArray(input.body) ? input.body as Record<string, unknown> : null;
    const statusCode = numberValue(body?.statusCode) ?? input.status;
    const errorCode = stringValue(body?.errorCode)
      ?? (isTimeout(input.error) ? 'REQUEST_TIMEOUT' : input.error ? 'NETWORK_ERROR' : input.text ? 'INVALID_SERVER_RESPONSE' : `HTTP_${statusCode ?? 'NETWORK'}`);
    const reasons = Array.isArray(body?.reasons) ? body.reasons.filter((item): item is string => typeof item === 'string') : typeof body?.reasons === 'string' ? [body.reasons] : [];
    const parsed: ApiError = {
      errorCode,
      message: userMessages[errorCode] ?? stringValue(body?.message) ?? safeText(input.text) ?? '操作失败，请稍后重试。',
      reasons,
      statusCode,
      requestId: stringValue(body?.requestId)
    };
    for (const key of diagnosticKeys) {
      const value = stringValue(body?.[key]);
      if (value) parsed[key] = value;
    }
    return parsed;
  } catch {
    return { errorCode: 'INVALID_SERVER_RESPONSE', message: userMessages.INVALID_SERVER_RESPONSE, reasons: [], statusCode: input.status };
  }
}

export function parseApiErrorText(status: number, text: string) {
  try {
    return parseApiError({ status, body: text ? JSON.parse(text) : undefined });
  } catch {
    return parseApiError({ status, text });
  }
}

export function apiErrorMessage(error: Pick<ApiError, 'errorCode' | 'message' | 'requestId'>) {
  return `${error.message}\n错误码：${error.errorCode}${error.requestId ? `\n请求ID：${error.requestId}` : ''}`;
}

function stringValue(value: unknown) { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
function numberValue(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function safeText(value?: string) { const text = value?.trim(); return text && text.length <= 500 ? text : undefined; }
function isTimeout(error: unknown) { return error instanceof Error && (error.name === 'AbortError' || /timeout/i.test(error.message)); }

export const operationalErrorMessages = userMessages;
