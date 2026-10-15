import { defineConfig, devices } from '@playwright/test';

// Tests de bout en bout sur le build de production, en mode démonstration (sans Supabase).
// La Battle multijoueur est testée avec 4 onglets reliés par BroadcastChannel.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/',
    viewport: { width: 1280, height: 800 },
    hasTouch: true,
    locale: 'fr-BE',
    timezoneId: 'Europe/Brussels',
    serviceWorkers: 'block',
  },
  projects: [{ name: 'tablette', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, hasTouch: true } }],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
