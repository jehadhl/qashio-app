import { z } from 'zod';

// Same rules as the NestJS LoginDto / RegisterDto, so most mistakes are caught
// before a request is sent. The API still validates everything.
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // bcrypt ignores anything longer
export const NAME_MIN = 2;
export const NAME_MAX = 50;
export const EMAIL_MAX = 255;

const email = z
  .string()
  .trim()
  .email('Enter a valid email')
  .max(EMAIL_MAX, `At most ${EMAIL_MAX} characters`)
  // Emails are case-insensitive; the API lower-cases them too.
  .transform((value) => value.toLowerCase());

const name = z
  .string()
  .trim()
  .min(NAME_MIN, `At least ${NAME_MIN} characters`)
  .max(NAME_MAX, `At most ${NAME_MAX} characters`);

export const loginSchema = z.object({
  email,
  // No length rules on login: they'd only tell attackers what valid passwords look like.
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX, `At most ${PASSWORD_MAX} characters`),
});

export const registerSchema = z
  .object({
    firstName: name,
    lastName: name,
    email,
    password: z
      .string()
      .min(PASSWORD_MIN, `At least ${PASSWORD_MIN} characters`)
      .max(PASSWORD_MAX, `At most ${PASSWORD_MAX} characters`),
    confirmPassword: z.string(),
  })
  .refine((values) => values.confirmPassword === values.password, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

// First message per field, e.g. { email: 'Enter a valid email' }, for helperText.
export function fieldErrors<Field extends string>(error: z.ZodError): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as Field;
    if (field && !errors[field]) errors[field] = issue.message;
  }
  return errors;
}
