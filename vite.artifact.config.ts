// Version HTML autonome : un seul fichier, mode démonstration, sans service worker.
// Usage : npx vite build --config vite.artifact.config.ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { appVersion } from './scripts/app-version.mjs';

export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/stubs/pwa-register.ts', import.meta.url)) },
  },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': '""',
    'import.meta.env.VITE_SUPABASE_ANON_KEY': '""',
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion()),
  },
  build: { outDir: 'dist-html', emptyOutDir: true, assetsInlineLimit: 100000000 },
});
