import { ClassSerializerInterceptor, NestInterceptor } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression = require('compression');
import helmet from 'helmet';
import { AppValidationPipe } from '@/common/pipes/validation.pipe';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '@/common/interceptors/logging.interceptor';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';

export interface ConfigureAppOptions {
  // Relaxes helmet's CSP outside production (Swagger UI needs inline scripts).
  isProd: boolean;
  // Production extras. Passed in rather than added by the caller so each one still
  // runs at its original position in the chain (e.g. CORS right after helmet, so
  // preflight responses keep the security headers). The e2e tests leave them out.
  cors?: CorsOptions;
  compression?: boolean;
  requestLogging?: boolean;
}

// The HTTP behaviour clients see - security headers, body limit, /api prefix,
// validation, error format, serialization, { success, data } envelope - shared by
// main.ts and the e2e tests so they can't drift apart.
export function configureApp(app: NestExpressApplication, options: ConfigureAppOptions): void {
  app.use(helmet({ contentSecurityPolicy: options.isProd ? undefined : false }));

  if (options.cors) {
    app.enableCors(options.cors);
  }

  app.useBodyParser('json', { limit: '100kb' });
  if (options.compression) {
    app.use(compression({ threshold: 1024 }));
  }

  app.setGlobalPrefix('api');

  app.useGlobalPipes(new AppValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());

  const interceptors: NestInterceptor[] = [
    // Outermost, so the logged duration covers serialization and the envelope.
    ...(options.requestLogging ? [new LoggingInterceptor()] : []),
    new ClassSerializerInterceptor(app.get(Reflector)),
    new TransformInterceptor(),
  ];
  app.useGlobalInterceptors(...interceptors);
}
