const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};

// createJestConfig is async (it loads next.config.js), so resolve it and split the
// tests in two: server code (lib/, app/api/, middleware) runs in Node (real fetch/Request/Response),
// everything else (UI) in jsdom.
module.exports = async () => {
  const base = await createJestConfig(customJestConfig)();
  return {
    // The repo is on /mnt/c (Windows drive in WSL): watchman gets no file events there,
    // so new test files would go unnoticed. Jest's own crawler sees them.
    watchman: false,
    projects: [
      {
        ...base,
        displayName: 'ui',
        testPathIgnorePatterns: [
          ...(base.testPathIgnorePatterns ?? []),
          '<rootDir>/lib/',
          '<rootDir>/app/api/',
          '<rootDir>/middleware.test.ts',
        ],
      },
      {
        ...base,
        displayName: 'server',
        testEnvironment: 'node',
        // Server code: lib/, the /api route handlers and the middleware.
        testMatch: [
          '<rootDir>/lib/**/*.test.ts',
          '<rootDir>/app/api/**/*.test.ts',
          '<rootDir>/middleware.test.ts',
        ],
      },
    ],
  };
}; 