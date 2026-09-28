import { ClientKafka } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { OutboxEvent } from '@/core/outbox/entities/outbox-event.entity';
import { OutboxStatus } from '@/core/outbox/enums/outbox-status.enum';
import { OutboxPublisher } from '@/core/outbox/outbox.publisher';

describe('OutboxPublisher', () => {
  const kafka = { emit: jest.fn(), close: jest.fn() };
  const publisher = new OutboxPublisher(kafka as unknown as ClientKafka);

  const event = Object.assign(new OutboxEvent(), {
    id: 'evt-1',
    topic: 'transaction.created',
    messageKey: 'user-1',
    payload: { eventId: 'evt-1', amount: 100 },
    status: OutboxStatus.PENDING,
    attempts: 0,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    kafka.close.mockResolvedValue(undefined);
  });

  it('sends key = user, value = payload, header event-id, and returns the ack', async () => {
    const record = {
      topicName: 'transaction.created',
      partition: 1,
      baseOffset: '9',
    };
    kafka.emit.mockReturnValue(of([record]));

    await expect(publisher.publish(event)).resolves.toBe(record);
    expect(kafka.emit).toHaveBeenCalledWith('transaction.created', {
      key: 'user-1',
      value: { eventId: 'evt-1', amount: 100 },
      headers: { 'event-id': 'evt-1' },
    });
  });

  it('rethrows a broker error and resets the client when Kafka is unreachable', async () => {
    const down = Object.assign(new Error('ECONNREFUSED'), {
      name: 'KafkaJSConnectionError',
    });
    kafka.emit.mockReturnValue(throwError(() => down));

    await expect(publisher.publish(event)).rejects.toBe(down);
    expect(kafka.close).toHaveBeenCalled();
  });

  it('rethrows a permanent error without resetting the client', async () => {
    const tooLarge = Object.assign(new Error('too large'), {
      name: 'KafkaJSProtocolError',
      type: 'MESSAGE_TOO_LARGE',
    });
    kafka.emit.mockReturnValue(throwError(() => tooLarge));

    await expect(publisher.publish(event)).rejects.toBe(tooLarge);
    expect(kafka.close).not.toHaveBeenCalled();
  });
});
