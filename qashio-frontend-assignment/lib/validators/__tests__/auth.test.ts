import { fieldErrors, loginSchema, registerSchema } from '../auth';

const validRegister = {
  firstName: 'Demo',
  lastName: 'User',
  email: 'demo@qashio.com',
  password: 'Secret123',
  confirmPassword: 'Secret123',
};

const errorsFor = (schema: typeof loginSchema | typeof registerSchema, values: unknown) => {
  const result = schema.safeParse(values);
  return result.success ? {} : fieldErrors(result.error);
};

describe('loginSchema', () => {
  it('accepts valid credentials and normalises the email', () => {
    expect(loginSchema.parse({ email: '  Demo@Qashio.COM ', password: 'x' })).toEqual({
      email: 'demo@qashio.com',
      password: 'x',
    });
  });

  it('requires a valid email and a password', () => {
    expect(errorsFor(loginSchema, { email: 'nope', password: '' })).toEqual({
      email: 'Enter a valid email',
      password: 'Enter your password',
    });
  });

  it('does not apply sign-up length rules to the password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(true);
  });

  it('caps the password at 72 characters (bcrypt limit)', () => {
    expect(errorsFor(loginSchema, { email: 'a@b.co', password: 'x'.repeat(73) })).toEqual({
      password: 'At most 72 characters',
    });
  });
});

describe('registerSchema', () => {
  it('accepts a valid form and returns trimmed, normalised values', () => {
    expect(
      registerSchema.parse({ ...validRegister, firstName: '  Demo ', lastName: ' User ', email: ' DEMO@qashio.com ' })
    ).toEqual(validRegister);
  });

  it('checks name length after trimming', () => {
    expect(errorsFor(registerSchema, { ...validRegister, firstName: ' A ', lastName: 'x'.repeat(51) })).toEqual({
      firstName: 'At least 2 characters',
      lastName: 'At most 50 characters',
    });
  });

  it('requires 8-72 character passwords', () => {
    expect(errorsFor(registerSchema, { ...validRegister, password: 'short', confirmPassword: 'short' }).password).toBe(
      'At least 8 characters'
    );
    const long = 'x'.repeat(73);
    expect(errorsFor(registerSchema, { ...validRegister, password: long, confirmPassword: long }).password).toBe(
      'At most 72 characters'
    );
  });

  it('requires the passwords to match, reported on confirmPassword', () => {
    expect(errorsFor(registerSchema, { ...validRegister, confirmPassword: 'Different1' })).toEqual({
      confirmPassword: 'Passwords do not match',
    });
  });

  it('rejects an email longer than the database column', () => {
    const email = `${'a'.repeat(250)}@b.com`;
    expect(errorsFor(registerSchema, { ...validRegister, email }).email).toBe('At most 255 characters');
  });

  it('fieldErrors keeps only the first message per field', () => {
    expect(Object.keys(errorsFor(registerSchema, {}))).toEqual(
      expect.arrayContaining(['firstName', 'lastName', 'email', 'password'])
    );
  });
});
