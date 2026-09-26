// app/api/transactions/[id]/route.ts
import { NextRequest } from 'next/server';
import { transactionService } from '@/lib/db';
import {
  createTransactionSchema,
  transactionIdSchema,
  updateTransactionSchema,
} from '@/lib/validators/transaction';
import { withBackend } from '@/lib/api/backend';
import { fromNestPayload } from '@/lib/api/nestContract';
import {
  errorResponse,
  handleUnexpectedError,
  jsonResponse,
  readJsonBody,
  zodErrorResponse,
} from '@/lib/api/http';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Validate the id before it touches the database; returns either the id or an error response.
const parseId = async ({ params }: RouteContext) => {
  const { id } = await params;
  const result = transactionIdSchema.safeParse(id);
  return result.success
    ? { id: result.data, error: null }
    : { id: null, error: zodErrorResponse(result.error, 'Invalid transaction id') };
};

const notFound = () => errorResponse(404, 'NOT_FOUND', 'Transaction not found');

// GET /api/transactions/:id - fetch a single transaction
async function getTransaction(_request: NextRequest, context: RouteContext) {
  try {
    const { id, error } = await parseId(context);
    if (error) return error;

    const transaction = await transactionService.getById(id);
    if (!transaction) return notFound();

    return jsonResponse(transaction);
  } catch (error) {
    return handleUnexpectedError(error, 'to fetch transaction');
  }
}

// PUT /api/transactions/:id - replace a transaction (all fields required).
// PATCH /api/transactions/:id - update some fields of a transaction.
const updateTransaction = (schema: typeof createTransactionSchema | typeof updateTransactionSchema) =>
  async function (request: NextRequest, context: RouteContext) {
    try {
      const { id, error } = await parseId(context);
      if (error) return error;

      const result = schema.safeParse(await fromNestPayload(await readJsonBody(request)));
      if (!result.success) return zodErrorResponse(result.error, 'Invalid input data');

      const transaction = await transactionService.update(id, result.data);
      if (!transaction) return notFound();

      return jsonResponse(transaction);
    } catch (error) {
      return handleUnexpectedError(error, 'to update transaction');
    }
  };

// DELETE /api/transactions/:id - remove a transaction
async function deleteTransaction(_request: NextRequest, context: RouteContext) {
  try {
    const { id, error } = await parseId(context);
    if (error) return error;

    const deleted = await transactionService.delete(id);
    if (!deleted) return notFound();

    return jsonResponse({ success: true, id });
  } catch (error) {
    return handleUnexpectedError(error, 'to delete transaction');
  }
}

// Proxied to NestJS when BACKEND_API_URL is set; see lib/api/backend.ts.
export const GET = withBackend(getTransaction);
export const PUT = withBackend(updateTransaction(createTransactionSchema));
export const PATCH = withBackend(updateTransaction(updateTransactionSchema));
export const DELETE = withBackend(deleteTransaction);
