import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';

function isExposedHttpError(
  exception: unknown,
): exception is { status: number; message: string } {
  return (
    exception instanceof Error &&
    'expose' in exception &&
    exception.expose === true &&
    'status' in exception &&
    typeof exception.status === 'number'
  );
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): Observable<never> | void {
    // Registered app-wide, so it also sees Kafka event errors: hand those back to
    // Nest's RPC handling instead of writing an HTTP response that doesn't exist.
    if (host.getType() !== 'http') {
      return throwError(() => exception);
    }

    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : isExposedHttpError(exception)
          ? exception.status
          : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = 'Internal server error';
    let errors: unknown;
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      message =
        typeof body === 'string'
          ? body
          : (body as { message: string | string[] }).message;
      // Per-field details from AppValidationPipe: [{ field, messages }]
      if (typeof body === 'object' && body && 'errors' in body)
        errors = body.errors;
    } else if (isExposedHttpError(exception)) {
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${req.method} ${req.originalUrl} ${status}`);
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      message, // array for validation errors (from ValidationPipe)
      ...(errors !== undefined && { errors }),
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
