// Integration: the real login page, auth service, api client and React Query.
// Only the network (fetch) and the router are faked.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../login/page';
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

const CACHE_KEY = 'qashio-query-cache';

const fillAndSubmit = async (user: ReturnType<typeof userEvent.setup>, email: string, password: string) => {
  if (email) await user.type(screen.getByLabelText('Email'), email);
  if (password) await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
};

describe('Login page', () => {
  beforeEach(() => {
    useToastStore.setState({ toast: null });
    localStorage.clear();
  });

  it('signs in: shows a spinner, then a success alert, caches the user and goes to /transactions', async () => {
    const user = userEvent.setup();
    const router = mockRouter();
    const reply = deferred<MockReply>();
    const fetchMock = mockFetch({ 'POST /api/auth/login': () => reply.promise });
    const { queryClient } = renderWithProviders(<LoginPage />);

    await fillAndSubmit(user, 'demo@qashio.com', 'Secret123');

    // In flight: spinner text, button and fields disabled.
    const button = screen.getByRole('button', { name: /signing in/i });
    expect(button).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeDisabled();

    reply.resolve({ body: { user: testUser } });

    expect(await screen.findByText('Welcome back, Demo!')).toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledWith('/transactions');
    expect(queryClient.getQueryData(currentUserQueryKey)).toEqual(testUser);
    expect(callsTo(fetchMock, 'POST', '/api/auth/login')).toEqual([
      { email: 'demo@qashio.com', password: 'Secret123', rememberMe: false },
    ]);
  });

  it('sends rememberMe when "Remember me" is ticked', async () => {
    const user = userEvent.setup();
    mockRouter();
    const fetchMock = mockFetch({ 'POST /api/auth/login': { body: { user: testUser } } });
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByLabelText('Remember me'));
    await fillAndSubmit(user, 'demo@qashio.com', 'Secret123');

    await waitFor(() => expect(callsTo(fetchMock, 'POST', '/api/auth/login')[0]).toMatchObject({ rememberMe: true }));
  });

  it('trims the email before sending', async () => {
    const user = userEvent.setup();
    mockRouter();
    const fetchMock = mockFetch({ 'POST /api/auth/login': { body: { user: testUser } } });
    renderWithProviders(<LoginPage />);

    await fillAndSubmit(user, '  demo@qashio.com  ', 'Secret123');

    await waitFor(() => expect(callsTo(fetchMock, 'POST', '/api/auth/login')[0].email).toBe('demo@qashio.com'));
  });

  it('drops a previous user\'s cached data on sign-in', async () => {
    const user = userEvent.setup();
    mockRouter();
    mockFetch({ 'POST /api/auth/login': { body: { user: testUser } } });
    localStorage.setItem(CACHE_KEY, '{"someone":"else"}');
    const { queryClient } = renderWithProviders(<LoginPage />);
    queryClient.setQueryData(['transactions', 'previous-user'], [{ id: 'x' }]);

    await fillAndSubmit(user, 'demo@qashio.com', 'Secret123');

    await screen.findByText('Welcome back, Demo!');
    expect(queryClient.getQueryData(['transactions', 'previous-user'])).toBeUndefined();
    expect(localStorage.getItem(CACHE_KEY)).toBeNull();
  });

  it('shows an error alert on wrong credentials and stays on the page', async () => {
    const user = userEvent.setup();
    const router = mockRouter();
    mockFetch({
      'POST /api/auth/login': {
        status: 401,
        body: { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } },
      },
    });
    renderWithProviders(<LoginPage />);

    await fillAndSubmit(user, 'demo@qashio.com', 'wrong-password');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invalid email or password');
    expect(router.replace).not.toHaveBeenCalled();
    // Ready to try again.
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('shows an error alert when the backend is down', async () => {
    const user = userEvent.setup();
    mockRouter();
    mockFetch({
      'POST /api/auth/login': { status: 502, body: { error: { message: 'Backend API is unavailable' } } },
    });
    renderWithProviders(<LoginPage />);

    await fillAndSubmit(user, 'demo@qashio.com', 'Secret123');

    expect(await screen.findByRole('alert')).toHaveTextContent('Backend API is unavailable');
  });

  it('validates before sending: no request for an empty or invalid form', async () => {
    const user = userEvent.setup();
    mockRouter();
    const fetchMock = mockFetch({});
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears a field error as soon as the user types in that field', async () => {
    const user = userEvent.setup();
    mockRouter();
    mockFetch({});
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.type(screen.getByLabelText('Password'), 'x');

    expect(screen.queryByText('Enter your password')).not.toBeInTheDocument();
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    mockRouter();
    renderWithProviders(<LoginPage />);
    const password = screen.getByLabelText('Password');

    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
  });
});
