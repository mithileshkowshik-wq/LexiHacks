import { defineConfig } from '@playwright/test';
import process from 'node:process';

const apiURL = 'http://127.0.0.1:5001';
const clientURL = 'http://127.0.0.1:4174';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'live-demo.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: 'line',
  use: {
    baseURL: clientURL,
    headless: false,
    launchOptions: { slowMo: 1000 },
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: [
    {
      command: 'node test-support/liveDemoServer.js',
      cwd: '../server',
      env: { ...process.env, RUN_LIVE_DEMO: 'true', PORT: '5001' },
      url: `${apiURL}/api/students`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 4174',
      env: { ...process.env, VITE_API_URL: `${apiURL}/api` },
      url: `${clientURL}/login`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});