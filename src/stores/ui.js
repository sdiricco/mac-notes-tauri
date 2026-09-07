import { defineStore } from 'pinia'

// Stato UI transitorio (dialoghi, pannelli) non persistito.
export const useUiStore = defineStore('ui', {
  state: () => ({
    settingsOpen: false,
    shortcutsOpen: false,
    // Un solo comando, il tasto in cima all'header. A finestra larga governa
    // il pannello delle cartelle; a finestra stretta, dove cartelle e lista
    // vivono insieme in un cassetto sovrapposto, apre e chiude il cassetto.
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
