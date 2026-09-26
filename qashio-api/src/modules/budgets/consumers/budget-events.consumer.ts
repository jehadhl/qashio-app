import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { KAFKA_TOPICS } from '@/core/kafka/kafka.constants';
import { BudgetsService } from '@/modules/budgets/budgets.service';
import { TransactionStatus, TransactionType } from '@/modules/transactions/enums/transaction.enums';
import { TransactionEventPayload } from '@/modules/transactions/events/transaction-event.payload';

const WARNING_THRESHOLD = 80; 

@Controller()
export class BudgetEventsConsumer {
  private readonly logger = new Logger(BudgetEventsConsumer.name);

  constructor(private readonly budgetsService: BudgetsService) {}

  @EventPattern(KAFKA_TOPICS.TRANSACTION_CREATED)
  onTransactionCreated(
    @Payload() event: TransactionEventPayload,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    return this.checkBudgets(event, context);
  }

  @EventPattern(KAFKA_TOPICS.TRANSACTION_UPDATED)
  onTransactionUpdated(
    @Payload() event: TransactionEventPayload,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    return this.checkBudgets(event, context);
  }

  private async checkBudgets(event: TransactionEventPayload, context: KafkaContext): Promise<void> {
    const startedAt = Date.now();
    const where = `${context.getTopic()} [partition ${context.getPartition()} @ offset ${context.getMessage().offset}]`;

    try {
      const summary = `tx=${event.transactionId} user=${event.userId}`;
      const lagMs = Date.now() - new Date(event.occurredAt).getTime();

      this.logger.debug(`← ${where} ${summary} ${event.type} ${event.amount} ${event.status} (lag ${lagMs}ms)`);

     
      if (event.type !== TransactionType.EXPENSE || event.status !== TransactionStatus.COMPLETED) {
        this.logger.debug(`↷ ${where} skipped: only completed expenses count towards budgets`);
        return;
      }

      const results = await this.budgetsService.checkUsageForCategory(event.userId, event.categoryId);

      for (const { budget, usage } of results) {
        const usageText = `${usage.spent}/${budget.amount} (${usage.percentage}%, ${budget.period})`;

        if (usage.isExceeded) {
          this.logger.warn(`${where} budget ${budget.id} exceeded for user ${event.userId}: ${usageText}`);
        } else if (usage.percentage >= WARNING_THRESHOLD) {
          this.logger.warn(`${where} budget ${budget.id} approaching limit for user ${event.userId}: ${usageText}`);
        } else {
          this.logger.debug(`${where} budget ${budget.id} within limit: ${usageText}`);
        }
      }

      this.logger.debug(`✓ ${where} checked ${results.length} budget(s) (${Date.now() - startedAt}ms)`);
    } catch (error) {
      this.logger.error(
        `✗ ${where} failed to process message`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}