import { defineConfig, devices } from '@playwright/test'

/**
 * Test su telefono simulato: l'app di prova (finto backend, nessun dato vero) aperta con le misure
 * e il motore di veri telefoni. WebKit è il motore di Safari su iPhone, Chromium quello di Chrome su Android.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5199/bere-app/dev/',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'iPhone SE', use: { ...devices['iPhone SE'] } },
    { name: 'iPhone 16e', use: { ...devices['iPhone 16e'] } },
    { name: 'Pixel 7', use: { ...devices['Pixel 7'] } },
    { name: 'Android piccolo', use: { ...devices['Galaxy S5'] } },
    // 320 px con i caratteri di Chrome: ha trovato gli orari «Dalle/Alle» fuori schermo.
    { name: 'Android 320', use: { ...devices['Galaxy S9+'] } },
  ],
  webServer: {
    command: 'npx vite --mode devapp --port 5199 --strictPort',
    url: 'http://localhost:5199/bere-app/dev/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
