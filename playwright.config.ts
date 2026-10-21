import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const URL = `http://localhost:${PORT}/component-ui/`;

export default defineConfig({
  testDir: 'tests/e2e',
  // Transpiling a component in the browser takes a few seconds.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: URL,
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Test the production build, which is what gets deployed.
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
    url: URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
