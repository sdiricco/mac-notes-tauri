import { defineStore } from 'pinia'

// Stato UI transitorio (dialoghi, pannelli) non persistito.
export const useUiStore = defineStore('ui', {
  state: () => ({
    settingsOpen: false,
    shortcutsOpen: false,
    sidebarVisible: true
  }),
  actions: {
    openSettings() {
      this.settingsOpen = true
    },
    openShortcuts() {
      this.shortcutsOpen = true
    },
    toggleSidebar() {
      this.sidebarVisible = !this.sidebarVisible
    }
  }
})
