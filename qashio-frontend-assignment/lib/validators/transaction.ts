import { z } from 'zod';

// Transaction form validation. The API validates again; the service maps the
// category name to its id before sending.
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

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
