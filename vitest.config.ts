import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    alias: { '@': path.resolve(__dirname, './src') },
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
