/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import IstanbulPlugin from 'vite-plugin-istanbul';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    sourcemap: true,
  },
  plugins: [react(), IstanbulPlugin({
    include: 'src/*',
    exclude: ['node_modules', 'test/'],
    extension: [ '.js', '.ts','.tsx' ],
  })],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: [
      '**/node_modules/**',
      'spec/e2e/**',
      '**/build/**',
      '**/coverage/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        'dist/',
        'spec/**',
        'spec/e2e/**',
        'test-results/**',
        '.eslintrc.cjs',
        'vite.config.ts',
        'playwright.config.ts',
        'tailwind.config.js',
        'postcss.config.js'
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    }
  }
})
