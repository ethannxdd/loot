import { defineConfig } from 'vitest/config'

// Unit tests cover the pure logic in src/lib (money, goals, tax, statements, debt). Kept separate from
// vite.config.ts so the router/tailwind plugins don't load for a plain node test run.
export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Dates are built from local components everywhere; pin the zone to one that is ahead of UTC so any
    // accidental toISOString() date maths would shift a day and fail loudly.
    globalSetup: ['./vitest.global-setup.ts'],
  },
})
