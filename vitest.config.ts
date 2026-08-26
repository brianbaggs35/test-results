import { fileURLToPath } from 'node:url'
import { defineConfig, coverageConfigDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'coverage/**',
        // vitest's own sensible defaults (test files, type declarations, config files, etc.)
        ...coverageConfigDefaults.exclude,
        // Vendored shadcn/ui primitives (generated boilerplate, not hand-written business logic)
        'src/components/ui/**'
      ],
      thresholds: {
        global: {
          branches: 90,
          functions: 92,
          lines: 95,
          statements: 93
        }
      }
    }
  }
})
