/**
 * Playwright configuration
 * ------------------------
 * The daily monitor (src/monitor.js) uses Playwright *as a library*, so this
 * file exists mainly to:
 *   1. Enable the "Playwright Test for VS Code" extension experience.
 *   2. Let you write/author quick UI checks with `npx playwright test`.
 *   3. Pre-configure the 3 viewports used by the monitor.
 *
 * Run optional test mode:      npx playwright test
 * Run the actual monitor:      node src/monitor.js
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Where optional tests live (create a tests/ folder if you add any)
  testDir: './tests',

  // Keep runs fast and CI-friendly
  timeout: 60 * 1000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Headless by default; flip to false locally to watch the browser
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
  },

  // The same 3 viewports the monitor screenshots with
  projects: [
    { name: 'mobile',  use: { ...devices['Pixel 7'] } },
    { name: 'tablet',  use: { viewport: { width: 768,  height: 1024 } } },
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  ],

  // Local HTML report via `npx playwright show-report`
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
});
