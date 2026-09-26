import { defineConfig } from '@playwright/test'

if (!process.env.E2E_MAIL_DIR || !process.env.E2E_ADMIN_PASSWORD) {
  throw new Error('Run from the repository root: .venv/Scripts/python scripts/test_e2e.py')
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5174',
    channel: process.env.E2E_BROWSER_CHANNEL || 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
    { name: 'narrow', use: { viewport: { width: 390, height: 844 } } },
  ],
})
