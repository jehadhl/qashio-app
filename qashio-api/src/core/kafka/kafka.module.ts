import { Global, Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import kafkaConfig from '@/core/config/kafka.config';
import { KAFKA_CLIENT } from '@/core/kafka/kafka.constants';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: KAFKA_CLIENT,
        inject: [kafkaConfig.KEY],
        useFactory: (kafka: ConfigType<typeof kafkaConfig>) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: kafka.clientId,
              brokers: kafka.brokers,
            },
            producerOnlyMode: true,
            producer: {
              allowAutoTopicCreation: false,
              createPartitioner: Partitioners.DefaultPartitioner,
            },
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class KafkaModule {}
