import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Build version for feedback context (Phase 6 B7). Vercel sets VERCEL_GIT_COMMIT_SHA.
  define: {
    __APP_VERSION__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7)),
  },
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
      // Phase 6 B2: our own worker (src/sw/sw.ts) so it can handle Web Push. Its caching rules are the same ones the
      // generated worker had: pre-cache the shell, SPA fallback, lazy /assets/ cache-first, Supabase never cached.
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,woff2}'],
        // Heavy, rarely-used libraries (pdf.js + its 1.3 MB worker for Statements, jsPDF/html2canvas for
        // exports) aren't pre-cached — they're cached the first time they're used instead (see sw.ts).
        globIgnores: ['**/pdf.worker*', '**/assets/pdf-*', '**/assets/jspdf*', '**/assets/html2canvas*', '**/assets/index.es-*'],
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
