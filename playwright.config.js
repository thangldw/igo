import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  webServer: {
    // Test the deployable artifact (versioned URLs, generated service worker), not the sources.
    command: 'node scripts/build.mjs && python3 -m http.server 4173 --directory public',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    serviceWorkers: 'block',
    baseURL: 'http://localhost:4173',
    channel: process.env.CI ? undefined : 'chrome',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 780 } } },
  ],
});
