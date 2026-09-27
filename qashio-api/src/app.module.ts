import {
  ClassSerializerInterceptor,
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
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
import throttleConfig from '@/core/config/throttle.config';
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
      useFactory: (db: ConfigType<typeof databaseConfig>) =>
        buildTypeOrmOptions(db),
    }),
    ThrottlerModule.forRootAsync({
      inject: [throttleConfig.KEY],
      useFactory: (throttle: ConfigType<typeof throttleConfig>) => [
        { ttl: throttle.ttl, limit: throttle.limit },
      ],
    }),
    KafkaModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    TransactionsModule,
    BudgetsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_PIPE, useClass: AppValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule implements NestModule {
  constructor(
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    const isProd = this.app.nodeEnv === 'production';

    consumer
      .apply(
        helmet({ contentSecurityPolicy: isProd ? undefined : false }),
        cors({ origin: this.app.corsOrigins, credentials: true }),
        compression({ threshold: 1024 }),
        cookieParser(),
      )
      .forRoutes('{*splat}');
  }
}
