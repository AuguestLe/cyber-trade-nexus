import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    environmentMatchGlobs: [
      ['src/**', 'jsdom'],
      ['server/**', 'node'],
    ],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['server/core/**/*.js', 'server/providers/**/*.js', 'src/lib/**/*.ts', 'src/store/**/*.ts'],
      exclude: ['src/map/worldOutline.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
});
