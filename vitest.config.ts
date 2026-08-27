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
    // server/**  tests live alongside their source rather than under src/test/ —
    // they belong to the separate tsconfig.node.json TS project, and importing
    // them from a src/ file trips TS6305 (see tsconfig.json's project reference).
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'server/**/*.{test,spec}.ts'],
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
