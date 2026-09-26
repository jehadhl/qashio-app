
import { z } from 'zod';


export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  searchTerm: z.string().max(100).optional(),
  status: z.enum(['Completed', 'Pending', 'Failed']).optional(),
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().trim().max(50).optional(),
  sortBy: z.enum(['date', 'amount']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});


export const createTransactionSchema = z.object({
  date: z
    .string({ required_error: 'Date is required' })
    .datetime('Please pick a valid date')
    .refine((value) => new Date(value) <= new Date(), 'Date cannot be in the future'),
  reference: z
    .string({ required_error: 'Reference is required' })
    .trim()
    .min(1, 'Reference is required')
    .max(50, 'Reference must be 50 characters or less'),
  counterparty: z
    .string({ required_error: 'Counterparty is required' })
    .trim()
    .min(1, 'Counterparty is required')
    .max(100, 'Counterparty must be 100 characters or less'),
  amount: z
    .number({ required_error: 'Amount is required', invalid_type_error: 'Amount is required' })
    .positive('Amount must be greater than 0')
    .max(1_000_000_000, 'Amount is too large')
    .multipleOf(0.01, 'Amount can have at most 2 decimal places'),
  status: z.enum(['Completed', 'Pending', 'Failed'], {
    errorMap: () => ({ message: 'Please select a status' }),
  }),
  type: z.enum(['income', 'expense'], {
    errorMap: () => ({ message: 'Please select a type' }),
  }).default('expense'),
  category: z
    .string({ required_error: 'Category is required' })
    .trim()
    .min(1, 'Category is required')
    .max(50, 'Category must be 50 characters or less'),
  narration: z
    .string({ required_error: 'Narration is required' })
    .trim()
    .min(1, 'Narration is required')
    .max(500, 'Narration must be 500 characters or less'),
})
  // Reject unknown keys (e.g. a client-supplied `id`) instead of silently accepting them.
  .strict();


export const updateTransactionSchema = createTransactionSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'At least one field must be provided');

// Ids are uuids for new rows, but seed data uses ids like "uuid-1234", so allow
// a safe character set rather than strict uuid format.
export const transactionIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid transaction id');


export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;