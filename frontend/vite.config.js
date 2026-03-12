import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const gitCount = execSync('git rev-list --count HEAD').toString().trim()
const gitSha = execSync('git rev-parse --short HEAD').toString().trim()
const buildTime = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14) // YYYYMMDDHHMMSS
const releaseName = `${buildTime.slice(0,8)}-${buildTime.slice(8)}-${gitSha}`

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(gitCount),
    __RELEASE_NAME__: JSON.stringify(releaseName),
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
