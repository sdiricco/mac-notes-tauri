import { defineStore } from 'pinia'

// Stato UI transitorio (dialoghi, pannelli) non persistito.
export const useUiStore = defineStore('ui', {
  state: () => ({
    settingsOpen: false,
    // Categoria mostrata nella pagina impostazioni. Nello store e non locale
    // alla pagina per due motivi: si riapre dov'era, e la voce di menu nativa
    // "Scorciatoie" deve poter aprire la pagina direttamente su quella
    // categoria.
    settingsSection: 'general',
    // A finestra stretta la pagina e' un master-detail: elenco categorie,
    // poi il dettaglio. Vero quando l'apertura ha chiesto una categoria
    // precisa, cosi' si atterra sul dettaglio e non sull'elenco.
    settingsSectionRequested: false,
    // Un solo pannello laterale, non due affiancati: mostra le note oppure
    // le cartelle. Si naviga fra le due viste con la freccia accanto al
    // titolo, come in un master-detail. Il tasto in cima all'header lo
    // mostra o lo nasconde, qualunque vista sia attiva.
    sidebarVisible: true,
    sidebarView: 'notes', // 'notes' | 'folders'
    // Finestra sotto la soglia del cassetto. Calcolata in App.vue (una sola
    // soglia per tutta l'app) e tenuta qui perche' serve anche a componenti
    // annidati come GlobalSearch, dove passarla come prop vorrebbe dire
    // attraversare Sidebar e NoteList solo per inoltrarla.
    narrow: false
  }),
  actions: {
    openSettings(section) {
      if (section) this.settingsSection = section
      this.settingsSectionRequested = Boolean(section)
      this.settingsOpen = true
    },
    closeSettings() {
      this.settingsOpen = false
    },
    // Le scorciatoie sono una categoria delle impostazioni, non piu' una
    // finestra a parte: la voce di menu nativa porta li'.
    openShortcuts() {
      this.openSettings('shortcuts')
    },
    toggleSidebar() {
      this.sidebarVisible = !this.sidebarVisible
    },
    showFolders() {
      this.sidebarView = 'folders'
    },
    showNotes() {
      this.sidebarView = 'notes'
    },
    setNarrow(value) {
      this.narrow = value
    }
  }
})
