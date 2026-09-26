import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
     
        if (data instanceof StreamableFile) return data;

        //  data + pagination + timestamp → success
        if (data instanceof PaginatedResponseDto) {
          return { success: true, ...data };
        }

        return {
          success: true,
          data: data ?? null,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}