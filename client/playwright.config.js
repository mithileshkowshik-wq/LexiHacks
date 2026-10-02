import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    launchOptions: {
      slowMo: 1000, // 1000ms (1 second) delay per action
    },
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node ../server/test-support/e2eServer.js',
      url: 'http://127.0.0.1:5000/api/students',
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'VITE_API_URL=http://127.0.0.1:5000/api npm run dev -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173/login',
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
