import { Global, Module } from '@nestjs/common';
import { IdempotencyService } from '@/core/outbox/idempotency.service';
import { OutboxCleanup } from '@/core/outbox/outbox.cleanup';
import { OutboxHealth } from '@/core/outbox/outbox.health';
import { OutboxPublisher } from '@/core/outbox/outbox.publisher';
import { OutboxRelay } from '@/core/outbox/outbox.relay';
import { OutboxService } from '@/core/outbox/outbox.service';

@Global()
@Module({
  providers: [
    OutboxService,
    IdempotencyService,
    OutboxPublisher,
    OutboxRelay,
    OutboxHealth,
    OutboxCleanup,
  ],
  exports: [OutboxService, IdempotencyService],
})
export class OutboxModule {}
