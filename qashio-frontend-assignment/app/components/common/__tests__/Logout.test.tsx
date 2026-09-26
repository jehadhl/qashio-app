// Integration: logging out from the navbar account menu, the sidebar and the profile page.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavBar from '../NavBar';
import Sidebar from '../Sidebar';
import ProfilePage from '@/app/profile/page';
import { usePathname } from 'next/navigation';
import { callsTo, mockFetch, mockRouter, renderWithProviders, testUser } from '@/test/utils';

const CACHE_KEY = 'qashio-query-cache';

const signedInRoutes = (logoutStatus = 200) => ({
  'GET /users/me': { body: { success: true, data: testUser, timestamp: 'now' } },
  'POST /auth/logout': { status: logoutStatus, body: { success: logoutStatus < 400 } },
});

describe('Logout', () => {
  beforeEach(() => {
    localStorage.clear();
    (usePathname as jest.Mock).mockReturnValue('/transactions');
  });

  describe('from the navbar account menu', () => {
    it('shows the signed-in user in the menu', async () => {
      const user = userEvent.setup();
      mockRouter();
      mockFetch(signedInRoutes());
      renderWithProviders(<NavBar />);

      await user.click(await screen.findByRole('button', { name: 'Open account menu' }));
      const menu = screen.getByRole('menu');

      expect(within(menu).getByText('Demo User')).toBeInTheDocument();
      expect(within(menu).getByText('demo@qashio.com')).toBeInTheDocument();
      expect(within(menu).getByRole('menuitem', { name: /profile/i })).toHaveAttribute('href', '/profile');
    });

    it('logs out: calls the API, clears all cached data and goes to /login', async () => {
      const user = userEvent.setup();
      const router = mockRouter();
      const fetchMock = mockFetch(signedInRoutes());
      localStorage.setItem(CACHE_KEY, '{"transactions":[1,2,3]}');
      const { queryClient } = renderWithProviders(<NavBar />);
      queryClient.setQueryData(['transactions', { page: 1 }], { data: [{ id: 't1' }] });
      // Wait for the user to load (initials in the avatar).
      await screen.findByText('Demo');

      await user.click(screen.getByRole('button', { name: 'Open account menu' }));
      await user.click(screen.getByRole('menuitem', { name: /log out/i }));

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
      expect(callsTo(fetchMock, 'POST', '/auth/logout')).toHaveLength(1);
      expect(queryClient.getQueryData(['transactions', { page: 1 }])).toBeUndefined();
      // Only the still-mounted navbar's own user query may reappear before the redirect
      // unmounts it; nothing from the session is left behind.
      const keys = queryClient.getQueryCache().getAll().map((q) => q.queryKey[0]);
      expect(keys.filter((key) => key !== 'currentUser')).toEqual([]);
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    });

    it('still signs out locally when the logout request fails', async () => {
      const user = userEvent.setup();
      const router = mockRouter();
      mockFetch(signedInRoutes(500));
      localStorage.setItem(CACHE_KEY, '{}');
      renderWithProviders(<NavBar />);
      await screen.findByText('Demo');

      await user.click(screen.getByRole('button', { name: 'Open account menu' }));
      await user.click(screen.getByRole('menuitem', { name: /log out/i }));

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
      expect(localStorage.getItem(CACHE_KEY)).toBeNull();
    });
  });

  it('logs out from the sidebar button', async () => {
    const user = userEvent.setup();
    const router = mockRouter();
    const fetchMock = mockFetch(signedInRoutes());
    renderWithProviders(<Sidebar />);

    expect(await screen.findByText('Demo User')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
    expect(callsTo(fetchMock, 'POST', '/auth/logout')).toHaveLength(1);
  });

  it('logs out from the profile page', async () => {
    const user = userEvent.setup();
    const router = mockRouter();
    mockFetch(signedInRoutes());
    renderWithProviders(<ProfilePage />);

    expect(await screen.findByText('Member since')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/login'));
  });
});
