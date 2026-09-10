// Bootstrap identico a mac-notes (main.js), portato senza modifiche
// concettuali: stessi plugin, stesso ordine.
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { RustNotesPreset } from './theme'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import 'primeicons/primeicons.css'
import './icons'
import './assets/main.css'
import { applyThemeEarly, applyLocaleEarly } from './stores/settings'
import { i18n } from './i18n'
import App from './App.vue'

applyThemeEarly()
applyLocaleEarly()

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.use(PrimeVue, {
  theme: { preset: RustNotesPreset, options: { darkModeSelector: '.dark-mode', cssLayer: false } },
})
app.use(ConfirmationService)
app.use(ToastService)
app.mount('#app')
