import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const gitCount = execSync('git rev-list --count HEAD').toString().trim()
const gitSha = execSync('git rev-parse --short HEAD').toString().trim()

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(`${gitCount}-${gitSha}`),
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:5001',
    },
  },
})
