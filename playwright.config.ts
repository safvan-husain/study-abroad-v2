import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 45_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3010',
    launchOptions: process.env.PLAYWRIGHT_HOST_RESOLVER_RULES
      ? { args: [`--host-resolver-rules=${process.env.PLAYWRIGHT_HOST_RESOLVER_RULES}`] }
      : undefined,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
});
