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

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponseLike>();
    const request = ctx.getRequest<HttpRequestLike>();
    const statusCode = this.getStatusCode(exception);

    response.status(statusCode).json({
      success: false,
      requestId: request.requestId,
      message: this.getMessage(exception),
      errorCode: this.getErrorCode(exception, statusCode),
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url
    });
  }

  private getMessage(exception: unknown) {
    const prismaCode = this.getPrismaErrorCode(exception);
    if (prismaCode === 'P2002') return '唯一约束冲突，数据已存在';
    if (prismaCode === 'P2025') return '记录不存在';
    if (prismaCode === 'P2003') return '外键关联错误，请检查关联数据是否存在';
    if (prismaCode) return `数据库请求错误：${prismaCode}`;
    if (this.isPrismaValidationError(exception)) return '数据库参数校验错误';

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') return response;
      if (typeof response === 'object' && response && 'message' in response) {
        const message = (response as { message: unknown }).message;
        return Array.isArray(message) ? message.join('; ') : String(message);
      }
      return exception.message;
    }

    if (exception instanceof Error) return exception.message;
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

  private getErrorCode(exception: unknown, statusCode: number) {
    const prismaCode = this.getPrismaErrorCode(exception);
    if (prismaCode) return prismaCode;
    if (exception instanceof HttpException) return `HTTP_${statusCode}`;
    if (this.isPrismaValidationError(exception)) return 'PRISMA_VALIDATION';
    return 'INTERNAL_ERROR';
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
