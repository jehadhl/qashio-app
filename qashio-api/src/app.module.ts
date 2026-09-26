import { ClassSerializerInterceptor, Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import compression = require('compression');
import cookieParser = require('cookie-parser');
import cors = require('cors');
import helmet from 'helmet';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { LoggingInterceptor } from '@/common/interceptors/logging.interceptor';
import { TransformInterceptor } from '@/common/interceptors/transform.interceptor';
import { AppValidationPipe } from '@/common/pipes/validation.pipe';
import configs from '@/core/config';
import appConfig from '@/core/config/app.config';
import databaseConfig from '@/core/config/database.config';
import { ENV_FILE_PATHS } from '@/core/config/env-files';
import { buildTypeOrmOptions } from '@/core/database/typeorm.options';
import { KafkaModule } from '@/core/kafka/kafka.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { BudgetsModule } from '@/modules/budgets/budgets.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import { UsersModule } from '@/modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ENV_FILE_PATHS,
      load: configs,
    }),
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (db: ConfigType<typeof databaseConfig>) => buildTypeOrmOptions(db),
    }),
    KafkaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    TransactionsModule,
    BudgetsModule,
  ],
  providers: [
    // Every route needs a valid access token unless @Public(); @Roles() is checked after.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // DTO validation, one error format, and the { success, data } envelope.
    { provide: APP_PIPE, useClass: AppValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Run in this order: logging is outermost, so its timing includes the rest.
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule implements NestModule {
  constructor(@Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>) {}

  configure(consumer: MiddlewareConsumer): void {
    const isProd = this.app.nodeEnv === 'production';

    consumer
      .apply(
        // Security headers; CSP relaxed outside production for Swagger UI.
        helmet({ contentSecurityPolicy: isProd ? undefined : false }),
        // After helmet, so preflight responses also carry the security headers.
        cors({ origin: this.app.corsOrigins, credentials: true }),
        compression({ threshold: 1024 }),
        // Auth tokens arrive as httpOnly cookies (see modules/auth/auth-cookies.ts).
        cookieParser(),
      )
      .forRoutes('*');
  }
}
