/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import IstanbulPlugin from 'vite-plugin-istanbul'
import { publishPlugin } from './server/publishPlugin'

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    sourcemap: true
  },
  plugins: [
    react(),
    publishPlugin(),
    IstanbulPlugin({
      include: 'src/*',
      exclude: ['node_modules', 'test/', 'src/test/**', '.history/**'],
      extension: ['.js', '.ts', '.tsx']
    })
  ]
  // Unit-test/coverage config lives in vitest.config.ts, which vitest prefers over
  // this file whenever both exist — a `test` block here would never actually run.
})
