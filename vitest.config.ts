import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Config separata da vite.config.ts: quella e' tarata su `tauri dev` (porta
// fissa, strictPort) e non ha senso per i test. jsdom serve perche' le utils
// usano DOMParser e navigator.
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js'],
    setupFiles: ['src/test/setup.js']
  }
})
