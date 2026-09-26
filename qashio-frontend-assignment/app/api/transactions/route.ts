
import { NextRequest, NextResponse } from 'next/server';
import { TransactionFilters, transactionService } from '@/lib/db';
import { createTransactionSchema } from '@/lib/validators/transaction';


export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const filters: TransactionFilters = {
    ...params,
    page: params.page ? Number(params.page) : undefined,
    limit: params.limit ? Number(params.limit) : undefined,
    sortBy: params.sortBy as TransactionFilters['sortBy'],
    sortOrder: params.sortOrder === 'desc' ? 'desc' : 'asc',
    type: params.type === 'income' || params.type === 'expense' ? params.type : undefined,
  };

  return NextResponse.json(await transactionService.query(filters));
}


export async function POST(request: NextRequest) {
  const result = createTransactionSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  return NextResponse.json(await transactionService.create(result.data), { status: 201 });
}
