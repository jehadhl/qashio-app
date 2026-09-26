// app/api/transactions/route.ts
import { NextRequest } from "next/server";
import { withBackend } from "@/lib/api/backend";
import { fromNestPayload, fromNestQuery } from "@/lib/api/nestContract";
import { transactionService } from "@/lib/db";
import {
  transactionQuerySchema,
  createTransactionSchema,
} from "@/lib/validators/transaction";
import {
  handleUnexpectedError,
  jsonResponse,
  readJsonBody,
  zodErrorResponse,
} from "@/lib/api/http";

// GET /api/transactions fetch all transation
async function listTransactions(request: NextRequest) {
  try {
    const params = await fromNestQuery(Object.fromEntries(request.nextUrl.searchParams));

    const result = transactionQuerySchema.safeParse(params);
    if (!result.success) {
      return zodErrorResponse(result.error, "Invalid query parameters");
    }

    return jsonResponse(await transactionService.query(result.data));
  } catch (error) {
    return handleUnexpectedError(error, "to fetch transactions");
  }
}

// create new transation
async function createTransaction(request: NextRequest) {
  try {
    const result = createTransactionSchema.safeParse(await fromNestPayload(await readJsonBody(request)));
    if (!result.success) {
      return zodErrorResponse(result.error, "Invalid input data");
    }

    const transaction = await transactionService.create(result.data);

    return jsonResponse(transaction, 201);
  } catch (error) {
    return handleUnexpectedError(error, "to create transaction");
  }
}

// Proxied to NestJS when BACKEND_API_URL is set; see lib/api/backend.ts.
export const GET = withBackend(listTransactions);
export const POST = withBackend(createTransaction);
