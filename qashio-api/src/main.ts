import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import { ConfigService, type ConfigType } from '@nestjs/config';
import { type MicroserviceOptions, Transport } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '@/app.module';
import { configureApp } from '@/core/app.setup';
import kafkaConfig from '@/core/config/kafka.config';
import { Partitioners } from 'kafkajs';
import { ensureKafkaTopics } from './core/kafka/kafka-topics.initializer';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 4000);
  const nodeEnv = configService.get<string>('app.nodeEnv', 'development');
  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);
  const databaseUrl = new URL(configService.getOrThrow<string>('database.url'));
  const databaseHost = `${databaseUrl.host}${databaseUrl.pathname}`;
  const isProd = nodeEnv === 'production';

  configureApp(app, {
    isProd,
    cors: { origin: corsOrigins, credentials: true },
    compression: true,
    requestLogging: true,
  });
  app.enableShutdownHooks();

  if (!isProd) {
    const config = new DocumentBuilder()
      .setTitle('Expense Tracker API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  // Kafka consumer (e.g. BudgetEventsConsumer) runs in this same process, next to HTTP.
  const kafka = configService.getOrThrow<ConfigType<typeof kafkaConfig>>('kafka');
  await ensureKafkaTopics(kafka.brokers, kafka.clientId);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: { clientId: `${kafka.clientId}-consumer`, brokers: kafka.brokers },
      consumer: { groupId: kafka.groupId },
      producer: { createPartitioner: Partitioners.DefaultPartitioner },
    },
  });
  await app.startAllMicroservices();

  await app.listen(port);

  logger.log(`
╔════════════════════════════════════════╗
║   ✓ Server running on port ${port}
║   ✓ Environment: ${nodeEnv}
║   ✓ Database: ${databaseHost}
║   ✓ Kafka: ${kafka.brokers.join(', ')} (group ${kafka.groupId})
╚════════════════════════════════════════╝`);
}

bootstrap().catch((error: unknown) => {
  console.error('Application failed to start:', error);
  process.exit(1);
});
