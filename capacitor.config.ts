import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor config for the Loot iOS/Android wrapper (Phase 5).
 *
 * This file alone does not produce native app projects — Capacitor's native platform
 * folders (`ios/`, `android/`) are generated locally by the Capacitor CLI, which needs
 * Xcode (for iOS) and/or Android Studio (for Android) installed, neither of which exists
 * in this build environment. After `npm install` picks up the new dependencies below, run:
 *
 *   npx cap add ios       # requires Xcode, macOS only
 *   npx cap add android   # requires Android Studio
 *   npm run build && npx cap sync
 *   npx cap open ios      # or: npx cap open android
 *
 * `webDir` points at Vite's production build output — always run `npm run build` before
 * `npx cap sync` so the native shells embed the latest web bundle.
 */
const config: CapacitorConfig = {
  appId: 'com.knowyourloot.app',
  appName: 'Loot',
  webDir: 'dist',
  backgroundColor: '#0F0A0A',
  server: {
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#0F0A0A',
  },
  android: {
    backgroundColor: '#0F0A0A',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#0F0A0A',
      showSpinner: false,
    },
  },
}

export default config
