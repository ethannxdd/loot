import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
    /**
     * PWA: a Workbox service worker that pre-caches the app shell so Loot opens instantly and offline.
     * - The manifest stays hand-written in public/manifest.webmanifest (linked from index.html).
     * - Registration and the "new version" prompt live in src/lib/pwa.ts (registerType 'prompt').
     * - Supabase is never cached: it's another origin and no route matches it, so every data request
     *   goes to the network and TanStack Query stays the only data cache.
     */
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,woff2}'],
        // Heavy, rarely-used libraries (pdf.js + its 1.3 MB worker for Statements, jsPDF/html2canvas for
        // exports) aren't pre-cached — they're cached the first time they're used instead (below).
        globIgnores: ['**/pdf.worker*', '**/assets/pdf-*', '**/assets/jspdf*', '**/assets/html2canvas*', '**/assets/index.es-*'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Built assets have content hashes in their names, so a cached copy never goes stale.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'loot-lazy-assets',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  server: {
    host: true,
  },
})
