// Un'unica istanza vue-i18n per componenti (useI18n) e codice fuori dai
// componenti (store Pinia, utils): questi ultimi usano `t` esportato qui,
// che legge sempre la lingua corrente.
//
// Le stringhe stanno in en/ e it/, un file per componente/dominio, cosi' chi
// aggiunge una lingua copia una cartella e chi tocca un componente trova le
// sue chiavi in un solo file. L'inglese e' la lingua di fallback: una chiave
// mancante in una traduzione mostra l'inglese, non la chiave grezza.
import { createI18n } from 'vue-i18n'
import en from './en'
import it from './it'
import es from './es'
import fr from './fr'
import de from './de'
import pt from './pt'
import zh from './zh'
import ja from './ja'

// Nome nativo di ogni lingua: e' quello che si mostra nel selettore, uguale
// qualunque sia la lingua attiva (come in ogni selettore di lingua), quindi
// sta qui e non nei file di traduzione. L'ordine e' quello del selettore.
export const LOCALES = [
  { code: 'en', name: 'English' },
  { code: 'it', name: 'Italiano' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' }
]
export const SUPPORTED_LOCALES = LOCALES.map((l) => l.code)
export const FALLBACK_LOCALE = 'en'

// 'system' -> lingua del sistema se supportata, altrimenti inglese.
export function resolveLocale(setting) {
  if (SUPPORTED_LOCALES.includes(setting)) return setting
  const sys = (navigator.language || '').slice(0, 2).toLowerCase()
  return SUPPORTED_LOCALES.includes(sys) ? sys : FALLBACK_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: FALLBACK_LOCALE,
  fallbackLocale: FALLBACK_LOCALE,
  messages: { en, it, es, fr, de, pt, zh, ja },
  // Chiavi mancanti/fallback loggano solo in sviluppo: in produzione e'
  // rumore per l'utente, in dev e' il segnale che una stringa e' sfuggita.
  missingWarn: import.meta.env.DEV,
  fallbackWarn: import.meta.env.DEV
})

export const t = (...args) => i18n.global.t(...args)

// Lingua attiva come stringa BCP47, per le API del browser (date, ordinamento).
export const currentLocale = () => i18n.global.locale.value

export function setLocale(locale) {
  i18n.global.locale.value = locale
  document.documentElement.lang = locale
}
