const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '**/*.spec.js',
  timeout: 60000,
  retries: 1,
  fullyParallel: true,
  workers: 6,
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})
