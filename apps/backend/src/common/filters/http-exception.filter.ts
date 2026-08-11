import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

interface HttpRequestLike {
  url: string;
  requestId?: string;
}

interface HttpResponseLike {
  status(statusCode: number): {
    json(body: unknown): unknown;
  };
}

export interface ApiErrorResponse {
  success: false;
  errorCode: string;
  message: string;
  reasons?: string[];
  requestId?: string;
  statusCode: number;
  timestamp: string;
  path: string;
  actionPlanId?: string;
  commandId?: string;
  queueJobId?: string;
  deviceId?: string;
}

const operationalFallbacks: Record<string, string> = {
  EMERGENCY_STOP_ACTIVE: 'Operation blocked by active emergency stop',
  REAL_CONTROL_DISABLED: 'Real device control is disabled',
  APPROVAL_REQUIRED: 'Manual approval is required',
  APPROVAL_RELEASE_NOT_IMPLEMENTED: 'Approved real-control release is not available',
  VALVE_FEEDBACK_REQUIRED: 'Valve feedback is required',
  VALVE_OFFLINE: 'Valve device is offline',
  FEEDBACK_TIMEOUT: 'Device feedback timed out',
  FEEDBACK_MISMATCH: 'Device feedback does not match the expected state',
  OUTCOME_UNKNOWN: 'Device execution outcome requires manual verification',
  AUTO_EXECUTION_REQUIRES_APPROVAL: 'Automatic execution requires approval',
  PERMISSION_DENIED: 'Permission denied',
  TENANT_ID_REQUIRED: 'Tenant context is required',
  SAFETY_BLOCKED: 'Operation blocked by safety policy'
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponseLike>();
    const request = ctx.getRequest<HttpRequestLike>();
    const statusCode = this.getStatusCode(exception);

    const structured = this.getStructuredResponse(exception);
    const body: ApiErrorResponse = {
      success: false,
      requestId: request.requestId,
      message: this.getMessage(exception, structured),
      errorCode: this.getErrorCode(exception, statusCode, structured),
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url
    };
    const reasons = this.getReasons(structured);
    if (reasons.length) body.reasons = reasons;
    for (const key of ['actionPlanId', 'commandId', 'queueJobId', 'deviceId'] as const) {
      const value = structured?.[key];
      if (typeof value === 'string' && value.length <= 256) body[key] = value;
    }
    response.status(statusCode).json(body);
  }

  private getMessage(exception: unknown, structured: Record<string, unknown> | null) {
    const prismaCode = this.getPrismaErrorCode(exception);
    if (prismaCode === 'P2002') return '唯一约束冲突，数据已存在';
    if (prismaCode === 'P2025') return '记录不存在';
    if (prismaCode === 'P2003') return '外键关联错误，请检查关联数据是否存在';
    if (prismaCode) return `数据库请求错误：${prismaCode}`;
    if (this.isPrismaValidationError(exception)) return '数据库参数校验错误';

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') return response;
      if (structured && 'message' in structured) {
        const message = structured.message;
        return Array.isArray(message) ? message.join('; ') : String(message);
      }
      const errorCode = typeof structured?.errorCode === 'string' ? structured.errorCode : null;
      if (errorCode) return operationalFallbacks[errorCode] ?? `Operation failed: ${errorCode}`;
      return exception.message;
    }

    return 'Internal server error';
  }

  private getStatusCode(exception: unknown) {
    if (exception instanceof HttpException) return exception.getStatus();
    const prismaCode = this.getPrismaErrorCode(exception);
    if (prismaCode === 'P2002') return HttpStatus.CONFLICT;
    if (prismaCode === 'P2025') return HttpStatus.NOT_FOUND;
    if (prismaCode === 'P2003') return HttpStatus.BAD_REQUEST;
    if (prismaCode) return HttpStatus.INTERNAL_SERVER_ERROR;
    if (this.isPrismaValidationError(exception)) return HttpStatus.BAD_REQUEST;
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getErrorCode(exception: unknown, statusCode: number, structured: Record<string, unknown> | null) {
    const prismaCode = this.getPrismaErrorCode(exception);
    if (prismaCode) return prismaCode;
    if (exception instanceof HttpException) {
      if (typeof structured?.errorCode === 'string' && /^[A-Z][A-Z0-9_]{2,127}$/.test(structured.errorCode)) return structured.errorCode;
      if (statusCode === HttpStatus.BAD_REQUEST && Array.isArray(structured?.message)) return 'VALIDATION_ERROR';
      return `HTTP_${statusCode}`;
    }
    if (this.isPrismaValidationError(exception)) return 'PRISMA_VALIDATION';
    return 'INTERNAL_ERROR';
  }

  private getStructuredResponse(exception: unknown) {
    if (!(exception instanceof HttpException)) return null;
    const value = exception.getResponse();
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
  }

  private getReasons(structured: Record<string, unknown> | null) {
    const reasons = structured?.reasons;
    if (typeof reasons === 'string') return [reasons];
    if (Array.isArray(reasons)) return reasons.filter((item): item is string => typeof item === 'string').slice(0, 50);
    const validation = structured?.message;
    return Array.isArray(validation) ? validation.filter((item): item is string => typeof item === 'string').slice(0, 50) : [];
  }

  private getPrismaErrorCode(exception: unknown) {
    if (typeof exception !== 'object' || !exception || !('code' in exception)) return null;
    const code = (exception as { code?: unknown }).code;
    return typeof code === 'string' && code.startsWith('P') ? code : null;
  }

  private isPrismaValidationError(exception: unknown) {
    return exception instanceof Error && exception.name === 'PrismaClientValidationError';
  }
}
