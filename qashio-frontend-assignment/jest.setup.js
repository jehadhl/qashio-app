// Import the jest-dom library for DOM testing assertions
import '@testing-library/jest-dom';

// Mock next/navigation. Tests that assert on navigation override useRouter with
// their own jest.fn()s via (useRouter as jest.Mock).mockReturnValue(...).
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

// React Query is NOT mocked: tests render with a real QueryClient (see
// test/utils.tsx) so mutations, cache updates and invalidation run for real.
