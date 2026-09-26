import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { BudgetsService } from '@/modules/budgets/budgets.service';
import { BudgetResponseDto } from '@/modules/budgets/dto/budget-response.dto';
import { CreateBudgetDto } from '@/modules/budgets/dto/create-budget.dto';
import { UpdateBudgetDto } from '@/modules/budgets/dto/update-budget.dto';
import { toBudgetResponse } from '@/modules/budgets/mappers/budget.mapper';

@ApiTags('Budgets')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  @ApiCreatedResponse({ type: BudgetResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiConflictResponse({ description: 'Budget for this category and period already exists' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBudgetDto,
  ): Promise<BudgetResponseDto> {
    return toBudgetResponse(await this.budgetsService.create(userId, dto));
  }

  @Get()
  @ApiOkResponse({ type: [BudgetResponseDto], description: 'Budgets with current spending' })
  async findAll(@CurrentUser('id') userId: string): Promise<BudgetResponseDto[]> {
    const budgets = await this.budgetsService.findAll(userId);
    return budgets.map(toBudgetResponse);
  }

  @Get(':id')
  @ApiOkResponse({ type: BudgetResponseDto })
  @ApiNotFoundResponse({ description: 'Budget not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BudgetResponseDto> {
    return toBudgetResponse(await this.budgetsService.findOne(userId, id));
  }

  @Put(':id')
  @ApiOkResponse({ type: BudgetResponseDto })
  @ApiNotFoundResponse({ description: 'Budget not found' })
  @ApiConflictResponse({ description: 'Budget for this category and period already exists' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBudgetDto,
  ): Promise<BudgetResponseDto> {
    return toBudgetResponse(await this.budgetsService.update(userId, id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Budget deleted' })
  @ApiNotFoundResponse({ description: 'Budget not found' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.budgetsService.remove(userId, id);
  }
}