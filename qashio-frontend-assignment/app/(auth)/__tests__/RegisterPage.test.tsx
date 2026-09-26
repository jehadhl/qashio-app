// Integration: the real register page, auth service, api client and React Query.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from '../register/page';
import { currentUserQueryKey } from '@/app/services/authService';
import { useToastStore } from '@/app/hooks/useToastStore';
import {
  callsTo,
  deferred,
  mockFetch,
  mockRouter,
  MockReply,
  renderWithProviders,
  testUser,
} from '@/test/utils';

type User = ReturnType<typeof userEvent.setup>;

const fillForm = async (
  user: User,
  values: Partial<Record<'firstName' | 'lastName' | 'email' | 'password' | 'confirm', string>> = {}
) => {
  const v = {
    firstName: 'Demo',
    lastName: 'User',
    email: 'demo@qashio.com',
    password: 'Secret123',
    confirm: 'Secret123',
    ...values,
  };
  if (v.firstName) await user.type(screen.getByLabelText('First name'), v.firstName);
  if (v.lastName) await user.type(screen.getByLabelText('Last name'), v.lastName);
  if (v.email) await user.type(screen.getByLabelText('Email'), v.email);
  if (v.password) await user.type(screen.getByLabelText('Password'), v.password);
  if (v.confirm) await user.type(screen.getByLabelText('Confirm password'), v.confirm);
};

const submit = (user: User) => user.click(screen.getByRole('button', { name: 'Create account' }));

describe('Register page', () => {
  beforeEach(() => {
    useToastStore.setState({ toast: null });
    localStorage.clear();
  });

  it('creates the account: spinner, success alert, cached user, then /transactions', async () => {
    const user = userEvent.setup();
    const router = mockRouter();
    const reply = deferred<MockReply>();
    const fetchMock = mockFetch({ 'POST /api/auth/register': () => reply.promise });
    const { queryClient } = renderWithProviders(<RegisterPage />);

    await fillForm(user);
    await submit(user);

    expect(screen.getByRole('button', { name: /creating account/i })).toBeDisabled();
    expect(screen.getByLabelText('First name')).toBeDisabled();

    reply.resolve({ status: 201, body: { user: testUser } });

    expect(await screen.findByText('Welcome, Demo! Your account is ready.')).toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledWith('/transactions');
    expect(queryClient.getQueryData(currentUserQueryKey)).toEqual(testUser);
    // confirmPassword is a UI-only field and is not sent.
    expect(callsTo(fetchMock, 'POST', '/api/auth/register')).toEqual([
      { firstName: 'Demo', lastName: 'User', email: 'demo@qashio.com', password: 'Secret123' },
    ]);
  });

  it('trims names and email before sending', async () => {
    const user = userEvent.setup();
    mockRouter();
    const fetchMock = mockFetch({ 'POST /api/auth/register': { status: 201, body: { user: testUser } } });
    renderWithProviders(<RegisterPage />);

    await fillForm(user, { firstName: '  Demo ', lastName: ' User  ', email: ' demo@qashio.com ' });
    await submit(user);

    await waitFor(() =>
      expect(callsTo(fetchMock, 'POST', '/api/auth/register')[0]).toMatchObject({
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@qashio.com',
      })
    );
  });

  it('shows an error alert when the email is already registered', async () => {
    const user = userEvent.setup();
    const router = mockRouter();
    mockFetch({
      'POST /api/auth/register': {
        status: 409,
        body: { success: false, error: { code: 'BACKEND_ERROR', message: 'Email is already registered' } },
      },
    });
    renderWithProviders(<RegisterPage />);

    await fillForm(user);
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Email is already registered');
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
  });

  it('validates every field before sending', async () => {
    const user = userEvent.setup();
    mockRouter();
    const fetchMock = mockFetch({});
    renderWithProviders(<RegisterPage />);

    await submit(user);

    expect(screen.getAllByText('At least 2 characters')).toHaveLength(2);
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    // Password helper text switches from the hint to the error.
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a short password', async () => {
    const user = userEvent.setup();
    mockRouter();
    const fetchMock = mockFetch({});
    renderWithProviders(<RegisterPage />);

    await fillForm(user, { password: 'short', confirm: 'short' });
    await submit(user);

    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('At least 8 characters')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects passwords that do not match', async () => {
    const user = userEvent.setup();
    mockRouter();
    const fetchMock = mockFetch({});
    renderWithProviders(<RegisterPage />);

    await fillForm(user, { confirm: 'Different123' });
    await submit(user);

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('links to the login page', () => {
    mockRouter();
    renderWithProviders(<RegisterPage />);

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});
