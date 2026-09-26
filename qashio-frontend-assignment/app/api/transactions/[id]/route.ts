import { NextRequest, NextResponse } from 'next/server';
import { transactionService } from '@/lib/db';
import { createTransactionSchema } from '@/lib/validators/transaction';

type Context = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: 'Transaction not found' }, { status: 404 });


export async function GET(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const transaction = await transactionService.getById(id);
  return transaction ? NextResponse.json(transaction) : notFound();
}

export async function PUT(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const result = createTransactionSchema.partial().safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const transaction = await transactionService.update(id, result.data);
  return transaction ? NextResponse.json(transaction) : notFound();
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const deleted = await transactionService.delete(id);
  return deleted ? NextResponse.json({ success: true, id }) : notFound();
}
