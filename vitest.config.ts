import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Enable globals like describe, it, expect for convenience
    globals: true,
    // Specify the environment (e.g., node, jsdom)
    environment: 'node',
    // Configure code coverage
    coverage: {
      // Use the v8 provider (requires @vitest/coverage-v8)
      provider: 'v8',
      // Specify files to include in coverage report
      include: ['src/**/*.ts'],
      // Specify files/patterns to exclude
      exclude: [
        'src/mcp/server.ts', // Entry point, often hard to test directly
        'src/**/*.test.ts', // Exclude test files themselves
        'src/**/*.e2e.test.ts', // Exclude E2E test files
        'src/types.ts', // Often just type definitions
        'src/config/*', // Configuration files might not need coverage
        '**/node_modules/**',
        '**/dist/**',
      ],
      // Enforce 100% coverage requirement as per guidelines
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
      // Generate different report formats
      reporter: ['text', 'json', 'html', 'lcov'],
      // Clean coverage results before running tests
      clean: true,
    },
    // Set a longer timeout for tests, especially E2E or integration tests
    hookTimeout: 30000, // 30 seconds
    testTimeout: 30000, // 30 seconds
  },
});
