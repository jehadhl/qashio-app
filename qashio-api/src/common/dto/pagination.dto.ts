import { IsIn, IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number = 10;

  @IsOptional()
  @Type(() => String)
  sortBy: string = 'createdAt';

  // Accepts asc/desc in any case (the frontend sends lowercase); stored upper-case for TypeORM.
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsIn(['ASC', 'DESC'])
  sortOrder: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @IsString()
  search?: string;
}

export function calculateSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}