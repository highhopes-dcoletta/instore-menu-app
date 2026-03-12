import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import i18n from './i18n'
import { initializeMsal } from './composables/useAuth'
import './style.css'

// MSAL must process the redirect response BEFORE the router runs,
// otherwise Vue Router normalizes the URL and strips the auth code.
initializeMsal().then(() => {
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.use(i18n)
  router.isReady().then(() => app.mount('#app'))
})
