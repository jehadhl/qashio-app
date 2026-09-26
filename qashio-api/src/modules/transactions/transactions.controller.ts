import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put ,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { CreateTransactionDto } from '@/modules/transactions/dto/create-transaction.dto';
import { TransactionQueryDto } from '@/modules/transactions/dto/transaction-query.dto';
import { TransactionResponseDto } from '@/modules/transactions/dto/transaction-response.dto';
import { UpdateTransactionDto } from '@/modules/transactions/dto/update-transaction.dto';
import { TransactionsService } from '@/modules/transactions/transactions.service';

@ApiTags('Transactions')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiCreatedResponse({ type: TransactionResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.transactionsService.create(userId, dto);
    return TransactionResponseDto.fromEntity(transaction);
  }

  @Get()
  @ApiOkResponse({ description: 'Paginated list of transactions' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() query: TransactionQueryDto,
  ): Promise<PaginatedResponseDto<TransactionResponseDto>> {
    const [transactions, total] = await this.transactionsService.findAll(userId, query);
    return new PaginatedResponseDto(
      transactions.map((transaction) => TransactionResponseDto.fromEntity(transaction)),
      query.page,
      query.limit,
      total,
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: TransactionResponseDto })
  @ApiNotFoundResponse({ description: 'Transaction not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.transactionsService.findOne(userId, id);
    return TransactionResponseDto.fromEntity(transaction);
  }

 

  @Put(':id')
  @ApiOkResponse({ type: TransactionResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'Transaction or category not found' })
  async update(
  @CurrentUser('id') userId: string,
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.transactionsService.update(userId, id, dto);
    return TransactionResponseDto.fromEntity(transaction);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Transaction deleted' })
  @ApiNotFoundResponse({ description: 'Transaction not found' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.transactionsService.remove(userId, id);
  }
}