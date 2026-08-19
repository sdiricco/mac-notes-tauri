// Bridge verso il main process Electron. Nel browser (preview/dev senza Electron)
// window.api non esiste: si usa un fallback su localStorage così l'app resta utilizzabile.

const STORAGE_KEY = 'mac-notes-data'

function browserDefaultData() {
  return {
    folders: [{ id: 'browser-folder-1', name: 'Note', createdAt: Date.now() }],
    notes: []
  }
}

const browserApi = {
  async loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    } catch {
      /* dati corrotti: si riparte dai default */
    }
    const data = browserDefaultData()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return data
  },

  // Nel browser non ha senso un file per nota: si tiene un unico blob in
  // localStorage, ma esposto con la stessa granularità dell'API Electron
  // (saveNote/deleteNoteFile/saveFolders) così lo store non deve saperne nulla.
  async saveNote(note) {
    const data = await browserApi.loadData()
    const idx = data.notes.findIndex((n) => n.id === note.id)
    if (idx >= 0) data.notes[idx] = note
    else data.notes.push(note)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  },

  async deleteNoteFile(id) {
    const data = await browserApi.loadData()
    data.notes = data.notes.filter((n) => n.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  },

  async saveFolders(folders) {
    const data = await browserApi.loadData()
    data.folders = folders
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  },

  onMenu() {
    return () => {}
  },

  // Nel browser non esiste il menu nativo: la modalità toolbar resta quella
  // salvata nelle impostazioni, senza spunta da allineare.
  async syncToolbarMode() {},

  async checkForUpdates() {},
  async getAppVersion() {
    return 'dev'
  },
  onUpdateCheckStatus() {
    return () => {}
  },

  // Nel browser non c'è un dialogo nativo: si simula con un download via <a>
  // e una selezione file via <input type="file"> nascosto.
  async exportMarkdown(markdown, suggestedName) {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${suggestedName || 'nota'}.md`
    a.click()
    URL.revokeObjectURL(url)
    return { filePath: a.download }
  },

  async importMarkdown() {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.md,.markdown,.txt'
      input.addEventListener('change', () => {
        const file = input.files?.[0]
        if (!file) return resolve(null)
        const reader = new FileReader()
        reader.onload = () => resolve({ markdown: String(reader.result), filePath: file.name })
        reader.readAsText(file)
      })
      input.addEventListener('cancel', () => resolve(null))
      input.click()
    })
  },

  // Nel browser non c'è un percorso locale utilizzabile: si legge il file
  // scelto come data URI, stesso formato restituito dall'equivalente Electron.
  async pickImage() {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.addEventListener('change', () => {
        const file = input.files?.[0]
        if (!file) return resolve(null)
        const reader = new FileReader()
        reader.onload = () => resolve({ dataUri: String(reader.result) })
        reader.readAsDataURL(file)
      })
      input.addEventListener('cancel', () => resolve(null))
      input.click()
    })
  },

  async readLocalImage() {
    // Nel browser non esiste un filesystem locale arbitrario da leggere per path.
    return null
  },

  async revealDataFile() {
    // Nel browser non c'è un Finder da aprire: nessuna azione possibile.
  }
}

export const api = window.api ?? browserApi
