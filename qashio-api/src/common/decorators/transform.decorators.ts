import { Transform } from 'class-transformer';

// Trims string input; leaves other types for the validators to reject.
export const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

// Trims and lower-cases, so " John@Mail.com" and "john@mail.com" are the same account.
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
