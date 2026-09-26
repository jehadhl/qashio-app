import { compare, hash } from 'bcryptjs';
import { createHash, timingSafeEqual } from 'crypto';

// 12 in real use. Tests can lower it with BCRYPT_ROUNDS (e.g. 4) so hashing doesn't
// dominate run time; bcrypt's minimum is 4. Read per call so env set by tests applies.
const DEFAULT_SALT_ROUNDS = 12;
const saltRounds = (): number => {
  const rounds = Number(process.env.BCRYPT_ROUNDS);
  return Number.isInteger(rounds) && rounds >= 4 && rounds <= 31
    ? rounds
    : DEFAULT_SALT_ROUNDS;
};

export const hashPassword = (password: string): Promise<string> =>
  hash(password, saltRounds());

export const verifyPassword = (
  password: string,
  passwordHash: string,
): Promise<boolean> => compare(password, passwordHash);

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const verifyTokenHash = (token: string, tokenHash: string): boolean => {
  const actual = Buffer.from(hashToken(token), 'hex');
  const expected = Buffer.from(tokenHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
