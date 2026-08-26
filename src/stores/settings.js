import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'

const KEY = 'mac-notes-settings'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}

// Applicato una volta prima del mount (in main.js) per evitare il flash di tema
export function applyThemeEarly() {
  const { theme = 'system' } = loadSaved()
  const dark = theme === 'dark' || (theme === 'system' && media.matches)
  document.documentElement.classList.toggle('dark-mode', dark)
  // Sincronizza anche l'aspetto nativo della finestra (titolo, bottoni di
  // sistema): con titleBarStyle "Visible" il colore del testo del titolo lo
  // decide macOS in base al Theme della NSWindow, non al contenuto della
  // webview — senza questo il titolo restava chiaro (nero su sfondo scuro)
  // anche con l'app in dark mode. Fire-and-forget: non c'è nulla da
  // attendere prima del mount, e non è disponibile fuori da Tauri (vedi
  // utils/api.js — qui non usiamo il fallback perché non è un dato
  // salvato, solo un side-effect innocuo se manca).
  invoke('set_window_theme', { dark }).catch(() => {})
}

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    theme: 'system', // 'system' | 'light' | 'dark'
    sortKey: 'updated', // 'updated' | 'created' | 'title'
    sortDir: 'desc', // 'asc' | 'desc'
    pinnedOnly: false,
    spellcheck: false, // correzione ortografica disattivata di default
    spellLang: 'it', // lingua della correzione quando attiva
    toolbarMode: 'compact', // 'compact' | 'extended' — menu "Vista > Toolbar"
    ...loadSaved()
  }),

  getters: {
    isDark: (state) => state.theme === 'dark' || (state.theme === 'system' && media.matches)
  },

  actions: {
    init() {
      this.applyTheme()
      media.addEventListener('change', () => {
        if (this.theme === 'system') this.applyTheme()
      })
    },

    applyTheme() {
      document.documentElement.classList.toggle('dark-mode', this.isDark)
      invoke('set_window_theme', { dark: this.isDark }).catch(() => {})
    },

    setTheme(theme) {
      this.theme = theme
      this.applyTheme()
      this.save()
    },

    setSort(key) {
      if (this.sortKey === key) {
        this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc'
      } else {
        this.sortKey = key
        this.sortDir = key === 'title' ? 'asc' : 'desc'
      }
      this.save()
    },

    togglePinnedOnly() {
      this.pinnedOnly = !this.pinnedOnly
      this.save()
    },

    setPinnedOnly(value) {
      this.pinnedOnly = value
      this.save()
    },

    setToolbarMode(mode) {
      if (mode !== 'compact' && mode !== 'extended') return
      this.toolbarMode = mode
      this.save()
    },

    toggleSpellcheck() {
      this.spellcheck = !this.spellcheck
      this.save()
    },

    setSpellLang(lang) {
      this.spellLang = lang
      if (!this.spellcheck) this.spellcheck = true
      this.save()
    },

    save() {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          theme: this.theme,
          sortKey: this.sortKey,
          sortDir: this.sortDir,
          pinnedOnly: this.pinnedOnly,
          spellcheck: this.spellcheck,
          spellLang: this.spellLang,
          toolbarMode: this.toolbarMode
        })
      )
    }
  }
})
