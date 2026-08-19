import { defineStore } from 'pinia'
import { api } from '../utils/api'

// Solo notifica: nessun download né installazione automatica (vedi
// main/updateCheck.js). Se disponibile una versione più recente, la UI mostra
// un avviso con l'istruzione per aggiornare via `brew upgrade --cask mac-notes`.
export const useUpdateCheckStore = defineStore('updateCheck', {
  state: () => ({
    available: false,
    checking: false,
    currentVersion: null,
    latestVersion: null,
    url: null
  }),

  actions: {
    async init() {
      this.currentVersion = await api.getAppVersion()
      api.onUpdateCheckStatus((status) => {
        this.available = status.available
        this.currentVersion = status.currentVersion ?? this.currentVersion
        this.latestVersion = status.latestVersion ?? this.latestVersion
        this.url = status.url ?? this.url
      })
    },

    // Controllo manuale (tasto in Impostazioni): l'esito arriva tramite lo
    // stesso evento onUpdateCheckStatus già in ascolto da init().
    async check() {
      this.checking = true
      try {
        await api.checkForUpdates()
      } finally {
        this.checking = false
      }
    }
  }
})
