import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    // Run headless in Codespaces
    headless: true,
    // Collect trace and screenshot on failure for Claude to inspect
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    // Base URL for your local dev server (adjust port if needed)
    baseURL: 'http://localhost:5173',
  },
  // Automatically spin up your dev server before running tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
