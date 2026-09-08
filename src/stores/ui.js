import { defineStore } from 'pinia'

// Stato UI transitorio (dialoghi, pannelli) non persistito.
export const useUiStore = defineStore('ui', {
  state: () => ({
    settingsOpen: false,
    shortcutsOpen: false,
    // Un solo pannello laterale, non due affiancati: mostra le note oppure
    // le cartelle. Si naviga fra le due viste con la freccia accanto al
    // titolo, come in un master-detail. Il tasto in cima all'header lo
    // mostra o lo nasconde, qualunque vista sia attiva.
    sidebarVisible: true,
    sidebarView: 'notes' // 'notes' | 'folders'
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
    },
    showFolders() {
      this.sidebarView = 'folders'
    },
    showNotes() {
      this.sidebarView = 'notes'
    }
  }
})
