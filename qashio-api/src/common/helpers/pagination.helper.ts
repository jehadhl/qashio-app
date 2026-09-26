import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { PaginationDto } from '@/common/dto/pagination.dto';

// Paginates a TypeORM query in the database (sort, count, then fetch one page).
export async function paginate<T extends ObjectLiteral>(
  query: SelectQueryBuilder<T>,
  paginationDto: PaginationDto,
): Promise<PaginatedResponseDto<T>> {
  const { page, limit, sortBy, sortOrder } = paginationDto;

  if (sortBy) {
    query.orderBy(`entity.${sortBy}`, sortOrder);
  }

  // Total rows before paging, for the pagination metadata.
  const total = await query.getCount();

  const skip = (page - 1) * limit;
  const data = await query.skip(skip).take(limit).getMany();

  return new PaginatedResponseDto(data, page, limit, total);
}

// Paginates an array that is already in memory.
export function paginateArray<T>(
  items: T[],
  page: number,
  limit: number,
): PaginatedResponseDto<T> {
  const total = items.length;
  const skip = (page - 1) * limit;
  const data = items.slice(skip, skip + limit);

  return new PaginatedResponseDto(data, page, limit, total);
}
