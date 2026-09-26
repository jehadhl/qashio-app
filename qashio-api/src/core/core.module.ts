import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import configs from '@/core/config';
import databaseConfig from '@/core/config/database.config';
import { ENV_FILE_PATHS } from '@/core/config/env-files';
import { buildTypeOrmOptions } from '@/core/database/typeorm.options';
import { KafkaModule } from '@/core/kafka/kafka.module';

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
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class CoreModule {}