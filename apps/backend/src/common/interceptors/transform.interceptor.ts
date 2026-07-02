import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, { success: true; data: T; message: string }> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<{ success: true; data: T; message: string }> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        message: 'ok'
      }))
    );
  }
}
