import { z } from 'zod';

export const CATEGORY_NAME_MAX = 50;

export const createCategorySchema = z
  .object({
    name: z
      .string({ required_error: 'Name is required', invalid_type_error: 'Name must be text' })
      .trim()
      .min(1, 'Name is required')
      .max(CATEGORY_NAME_MAX, `Name must be ${CATEGORY_NAME_MAX} characters or less`),
  })
  // Reject unknown keys (e.g. a client-supplied `id`) instead of silently accepting them.
  .strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
