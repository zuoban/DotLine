import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);
const baseURL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './benchmarks',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15 * 60_000,
  globalTimeout: 20 * 60_000,
  reporter: [['line']],
  outputDir: 'performance-results/test-artifacts',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    acceptDownloads: true,
    launchOptions: {
      args: ['--enable-precise-memory-info'],
    },
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: isCI
      ? 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort'
      : 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium-performance',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
