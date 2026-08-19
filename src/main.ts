// Bootstrap identico a mac-notes (main.js), portato senza modifiche
// concettuali: stessi plugin, stesso ordine.
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import 'primeicons/primeicons.css'
import './icons'
import './assets/main.css'
import { applyThemeEarly } from './stores/settings'
import App from './App.vue'

applyThemeEarly()

const app = createApp(App)
app.use(createPinia())
app.use(PrimeVue, {
  theme: { preset: Aura, options: { darkModeSelector: '.dark-mode', cssLayer: false } },
})
app.use(ConfirmationService)
app.use(ToastService)
app.mount('#app')
