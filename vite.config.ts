import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig(({ mode }) => {
  // L'app di prova usa lo stesso codice, ma il finto backend prende il posto di Supabase.
  const dev = mode === 'devapp'
  const iconPrefix = dev ? 'dev-' : ''
  const themeColor = dev ? '#fff1e0' : '#e8f7fb'

  return {
    base: dev ? '/bere-app/dev/' : '/bere-app/',
    define: { __APP_VERSION__: JSON.stringify(version) },
    build: dev ? { outDir: 'dist/dev' } : {},
    resolve: dev
      ? { alias: [{ find: /^.*\/lib\/supabase$/, replacement: fileURLToPath(new URL('./src/dev/devBackend.ts', import.meta.url)) }] }
      : {},
    plugins: [
      react(),
      {
        name: 'html-per-app',
        transformIndexHtml: (html: string) =>
          html
            .replaceAll('__NAME__', dev ? 'Bere Dev' : 'Bere')
            .replaceAll('__ICON_PREFIX__', iconPrefix)
            .replaceAll('__THEME__', themeColor),
      },
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectManifest: { globPatterns: ['**/*.{js,css,html,woff2,png,svg}'] },
        manifest: {
          name: dev ? 'Bere Dev' : 'Bere',
          short_name: dev ? 'Bere Dev' : 'Bere',
          description: dev ? 'App di prova di Bere: nessun account, nessun dato sul server' : 'Promemoria per bere durante la giornata',
          lang: 'it',
          display: 'standalone',
          start_url: '.',
          scope: '.',
          background_color: themeColor,
          theme_color: themeColor,
          icons: [
            { src: `${iconPrefix}icon-192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${iconPrefix}icon-512.png`, sizes: '512x512', type: 'image/png' },
            { src: `${iconPrefix}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          // Pressione lunga sull'icona: la schermata Oggi esegue l'azione e torna normale.
          shortcuts: [
            {
              name: 'Segna una bevuta',
              short_name: 'Ho bevuto',
              url: './#/home?azione=bevi',
              icons: [{ src: `${iconPrefix}shortcut-drink.png`, sizes: '192x192', type: 'image/png' }],
            },
            {
              name: 'Segna un caffè',
              short_name: 'Caffè',
              url: './#/home?azione=caffe',
              icons: [{ src: `${iconPrefix}shortcut-coffee.png`, sizes: '192x192', type: 'image/png' }],
            },
          ],
        },
      }),
    ],
  }
})
