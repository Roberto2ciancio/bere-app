import { defineConfig, devices } from '@playwright/test'

/**
 * Test su telefono simulato: l'app di prova (finto backend, nessun dato vero) aperta con le misure
 * e il motore di veri telefoni. WebKit è il motore di Safari su iPhone, Chromium quello di Chrome su Android.
 */
export default defineConfig<{ textScale: number }>({
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
    // Tema scuro automatico e «riduci movimento»: stesse misure, impostazioni del telefono diverse.
    { name: 'Pixel 7 scuro', use: { ...devices['Pixel 7'], colorScheme: 'dark' } },
    { name: 'iPhone SE ridotto', use: { ...devices['iPhone SE'], reducedMotion: 'reduce' } },
    // Le misure della proposta della nuova Home: 320×640, anche con «Dimensione carattere» al 130%.
    { name: '390×844', use: { ...devices['iPhone 16e'], viewport: { width: 390, height: 844 } } },
    { name: '320×640', use: { ...devices['Galaxy S9+'], viewport: { width: 320, height: 640 } } },
    { name: '320×640 testo 130%', use: { ...devices['Galaxy S9+'], viewport: { width: 320, height: 640 }, textScale: 1.3 } },
  ],
  webServer: {
    command: 'npx vite --mode devapp --port 5199 --strictPort',
    url: 'http://localhost:5199/bere-app/dev/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
