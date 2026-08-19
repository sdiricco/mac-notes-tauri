import { defineStore } from 'pinia'

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
