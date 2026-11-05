import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';
const cache = join(homedir(), '.cache', 'ms-playwright');
const installed = existsSync(cache)
  ? readdirSync(cache)
      .filter((name) => name.startsWith('chromium_headless_shell-'))
      .sort()
      .reverse()
      .map((name) => join(cache, name, 'chrome-headless-shell-linux64', 'chrome-headless-shell'))
      .find((path) => existsSync(path))
  : undefined;
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? installed;
export default defineConfig({
  testDir: 'app/test/e2e',
  // CI shards a single spec by test; one worker per shard avoids concurrent fixtures.
  fullyParallel: Boolean(process.env.CI),
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true,
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'npm run dev -w @plannedwallet/app -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
});
