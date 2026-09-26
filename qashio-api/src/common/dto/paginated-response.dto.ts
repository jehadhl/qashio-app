export class PaginatedResponseDto<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  timestamp: string;

  constructor(
    data: T[],
    page: number,
    limit: number,
    total: number
  ) {
    this.data = data;
    this.pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    };
    this.timestamp = new Date().toISOString();
  }
}