import { defineStore } from 'pinia'
import { v4 as uuid } from 'uuid'
import { stripHtml, extractTitleFromHtml } from '../utils/markdown'
import { api } from '../utils/api'
import { useSettingsStore } from './settings'
import { t, currentLocale } from '../i18n'

const ALL = 'all'
const TRASH = 'trash'
const PINNED = 'pinned'

// Viste che non corrispondono a una cartella reale. Raccolte in un insieme
// perche' vanno escluse in piu' punti (createNote sopra tutto): con i
// confronti sparsi, aggiungere una vista significa ricordarsi di aggiornarli
// tutti, e dimenticarne uno assegna alle note un folderId inesistente.
const VIRTUAL_VIEWS = new Set([ALL, TRASH, PINNED])

// I Proxy reattivi di Pinia non sono serializzabili via IPC: servono oggetti puri.
const cloneNote = (note) => JSON.parse(JSON.stringify(note))
const cloneFolders = (folders) => JSON.parse(JSON.stringify(folders))

// Persistenza granulare: un file per nota (vedi main/store.js), non un unico
// blob con tutto l'archivio, per evitare di riscrivere ogni nota a ogni
// battitura. Il debounce è per-id così digitare in una nota non cancella il
// salvataggio in sospeso di un'altra nota (es. cambio nota entro 350ms).
const NOTE_SAVE_DELAY = 350
const pendingNoteSaves = new Map()

function cancelPendingSave(id) {
  clearTimeout(pendingNoteSaves.get(id))
  pendingNoteSaves.delete(id)
}

function scheduleNoteSave(note) {
  cancelPendingSave(note.id)
  const snapshot = cloneNote(note)
  pendingNoteSaves.set(
    note.id,
    setTimeout(() => {
      pendingNoteSaves.delete(note.id)
      api.saveNote(snapshot)
    }, NOTE_SAVE_DELAY)
  )
}

// Azioni discrete (non per-keystroke): si salva subito, niente debounce.
function saveNoteNow(note) {
  cancelPendingSave(note.id)
  api.saveNote(cloneNote(note))
}

function deleteNoteFile(id) {
  cancelPendingSave(id)
  api.deleteNoteFile(id)
}

function saveFoldersNow(folders) {
  api.saveFolders(cloneFolders(folders))
}

export const useNotesStore = defineStore('notes', {
  state: () => ({
    folders: [],
    notes: [],
    selectedFolderId: ALL,
    selectedNoteId: null,
    ready: false
  }),

  getters: {
    isTrashView: (state) => state.selectedFolderId === TRASH,
    isAllView: (state) => state.selectedFolderId === ALL,
    isPinnedView: (state) => state.selectedFolderId === PINNED,

    currentFolder: (state) => state.folders.find((f) => f.id === state.selectedFolderId) || null,

    // Nome della vista corrente, cartella reale o virtuale. Sta qui e non nei
    // componenti perche' lo mostrano sia l'intestazione della lista sia il
    // breadcrumb nell'header: due copie finirebbero per divergere.
    currentViewName: (state) => {
      if (state.selectedFolderId === ALL) return t('store.allNotes')
      if (state.selectedFolderId === PINNED) return t('store.pinned')
      if (state.selectedFolderId === TRASH) return t('store.trash')
      return state.folders.find((f) => f.id === state.selectedFolderId)?.name || t('store.notes')
    },

    folderCount: (state) => (folderId) =>
      state.notes.filter((n) => n.folderId === folderId && !n.trashed).length,

    trashCount: (state) => state.notes.filter((n) => n.trashed).length,
    allCount: (state) => state.notes.filter((n) => !n.trashed).length,
    pinnedCount: (state) => state.notes.filter((n) => n.pinned && !n.trashed).length,

    visibleNotes: (state) => {
      const settings = useSettingsStore()
      let list = state.notes.filter((n) => {
        if (state.selectedFolderId === TRASH) return n.trashed
        if (n.trashed) return false
        if (state.selectedFolderId === ALL) return true
        if (state.selectedFolderId === PINNED) return n.pinned
        return n.folderId === state.selectedFolderId
      })
      // Nella vista Preferiti il filtro "solo preferiti" e' implicito:
      // applicarlo di nuovo non cambia nulla ma lascerebbe una spunta attiva
      // apparentemente senza effetto.
      if (
        settings.pinnedOnly &&
        state.selectedFolderId !== TRASH &&
        state.selectedFolderId !== PINNED
      ) {
        list = list.filter((n) => n.pinned)
      }
      const dir = settings.sortDir === 'asc' ? 1 : -1
      return list.slice().sort((a, b) => {
        // i preferiti restano sempre in cima
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        if (settings.sortKey === 'title') {
          const ta = a.title?.trim() || t('common.untitledNote')
          const tb = b.title?.trim() || t('common.untitledNote')
          return dir * ta.localeCompare(tb, currentLocale(), { sensitivity: 'base' })
        }
        if (settings.sortKey === 'created') return dir * (a.createdAt - b.createdAt)
        return dir * (a.updatedAt - b.updatedAt)
      })
    },

    selectedNote: (state) => state.notes.find((n) => n.id === state.selectedNoteId) || null
  },

  actions: {
    async init() {
      const data = await api.loadData()
      this.folders = data.folders
      this.notes = data.notes
      this.selectedFolderId = ALL
      const firstNote = this.visibleNotes[0]
      this.selectedNoteId = firstNote ? firstNote.id : null
      this.ready = true
    },

    selectFolder(folderId) {
      this.selectedFolderId = folderId
      const first = this.visibleNotes[0]
      this.selectedNoteId = first ? first.id : null
    },

    selectNote(noteId) {
      this.selectedNoteId = noteId
    },

    // Apre una nota trovata dalla ricerca globale, che puo' stare in una
    // cartella diversa da quella selezionata: si passa alla vista che la
    // contiene sicuramente, altrimenti la lista non la mostrerebbe.
    // selectedFolderId e' assegnato direttamente e non via selectFolder(),
    // che sovrascriverebbe selectedNoteId con la prima nota visibile.
    revealNote(noteId) {
      const note = this.notes.find((n) => n.id === noteId)
      if (!note) return
      this.selectedFolderId = note.trashed ? TRASH : ALL
      this.selectedNoteId = noteId
    },

    createNote(folderId) {
      // Da "Tutte le note" (o dal cestino, anche se lì il tasto "Nuova nota"
      // non è mai visibile) la nota resta senza cartella (folderId: null)
      // invece di finire assegnata in silenzio alla prima cartella della
      // lista: altrimenti sembra "sparire" dentro una cartella scelta a caso
      // e ricompare come duplicato quando poi la apri.
      const targetFolder =
        folderId || (VIRTUAL_VIEWS.has(this.selectedFolderId) ? null : this.selectedFolderId)
      const now = Date.now()
      const note = {
        id: uuid(),
        title: '',
        content: '',
        folderId: targetFolder,
        pinned: false,
        trashed: false,
        createdAt: now,
        updatedAt: now
      }
      this.notes.unshift(note)
      // targetFolder null = nota senza cartella: la vista deve restare su
      // "Tutte le note" (ALL), non diventare null — con selectedFolderId null
      // visibleNotes cade sul confronto n.folderId === null e mostrerebbe solo
      // le note senza cartella, con nessuna voce attiva nella sidebar.
      this.selectedFolderId = targetFolder || ALL
      // il filtro "solo preferiti" nasconderebbe la nota appena creata,
      // facendola sembrare persa: nasce non preferita
      useSettingsStore().setPinnedOnly(false)
      this.selectedNoteId = note.id
      saveNoteNow(note)
      return note
    },

    updateNote(id, patch) {
      const note = this.notes.find((n) => n.id === id)
      if (!note) return
      // Niente titolo digitato a mano: quando cambia il contenuto lo deduciamo
      // dal primo h1/h2/h3 (vuoto se non c'è). Sovrascrive un'eventuale
      // rinomina manuale precedente, per rispecchiare sempre il contenuto.
      const finalPatch = 'content' in patch ? { ...patch, title: extractTitleFromHtml(patch.content) } : patch
      Object.assign(note, finalPatch, { updatedAt: Date.now() })
      scheduleNoteSave(note)
    },

    duplicateNote(id) {
      const note = this.notes.find((n) => n.id === id)
      if (!note) return
      const now = Date.now()
      const copy = {
        ...JSON.parse(JSON.stringify(note)),
        id: uuid(),
        title: `${note.title?.trim() || t('common.untitledNote')} ${t('common.copySuffix')}`,
        pinned: false,
        trashed: false,
        createdAt: now,
        updatedAt: now
      }
      const idx = this.notes.findIndex((n) => n.id === id)
      this.notes.splice(idx + 1, 0, copy)
      this.selectedNoteId = copy.id
      saveNoteNow(copy)
      return copy
    },

    togglePin(id) {
      const note = this.notes.find((n) => n.id === id)
      if (!note) return
      note.pinned = !note.pinned
      saveNoteNow(note)
    },

    trashNote(id) {
      const note = this.notes.find((n) => n.id === id)
      if (!note) return
      note.trashed = true
      note.updatedAt = Date.now()
      if (this.selectedNoteId === id) {
        const next = this.visibleNotes.find((n) => n.id !== id)
        this.selectedNoteId = next ? next.id : null
      }
      saveNoteNow(note)
    },

    // Selezione multipla in NoteList.vue: sposta più note nel cestino in un
    // solo colpo invece di richiamare trashNote in loop (un solo ricalcolo
    // di selectedNoteId al termine, non uno per nota).
    trashNotes(ids) {
      const idSet = new Set(ids)
      let touchedSelected = false
      this.notes.forEach((note) => {
        if (!idSet.has(note.id) || note.trashed) return
        note.trashed = true
        note.updatedAt = Date.now()
        saveNoteNow(note)
        if (note.id === this.selectedNoteId) touchedSelected = true
      })
      if (touchedSelected) {
        const next = this.visibleNotes[0]
        this.selectedNoteId = next ? next.id : null
      }
    },

    moveNoteToFolder(id, folderId) {
      this.moveNotesToFolder([id], folderId)
    },

    // Come per trashNote/trashNotes, la variante plurale esiste per la
    // selezione multipla di NoteList.vue: un solo ricalcolo di
    // selectedNoteId al termine invece di uno per nota.
    // folderId null significa "senza cartella", coerente con createNote.
    moveNotesToFolder(ids, folderId) {
      const idSet = new Set(ids)
      let touchedSelected = false
      this.notes.forEach((note) => {
        if (!idSet.has(note.id) || note.folderId === folderId) return
        note.folderId = folderId
        note.updatedAt = Date.now()
        saveNoteNow(note)
        if (note.id === this.selectedNoteId) touchedSelected = true
      })
      // Spostando una nota fuori dalla cartella in vista sparisce dalla
      // lista: senza questo selectedNoteId resterebbe puntato a una nota non
      // piu' visibile, con l'editor che mostra un contenuto irraggiungibile.
      // In vista "Tutte le note" resta visibile e la selezione non si tocca.
      if (touchedSelected && !this.visibleNotes.some((n) => n.id === this.selectedNoteId)) {
        const next = this.visibleNotes[0]
        this.selectedNoteId = next ? next.id : null
      }
    },

    restoreNote(id) {
      const note = this.notes.find((n) => n.id === id)
      if (!note) return
      note.trashed = false
      note.updatedAt = Date.now()
      saveNoteNow(note)
    },

    deleteNotePermanently(id) {
      this.notes = this.notes.filter((n) => n.id !== id)
      if (this.selectedNoteId === id) {
        const next = this.visibleNotes[0]
        this.selectedNoteId = next ? next.id : null
      }
      deleteNoteFile(id)
    },

    // Controparte di trashNotes per il cestino: elimina definitivamente più
    // note selezionate in un solo colpo.
    deleteNotesPermanently(ids) {
      const idSet = new Set(ids)
      const touchedSelected = this.selectedNoteId && idSet.has(this.selectedNoteId)
      this.notes = this.notes.filter((n) => !idSet.has(n.id))
      if (touchedSelected) {
        const next = this.visibleNotes[0]
        this.selectedNoteId = next ? next.id : null
      }
      ids.forEach(deleteNoteFile)
    },

    emptyTrash() {
      const trashedIds = this.notes.filter((n) => n.trashed).map((n) => n.id)
      this.notes = this.notes.filter((n) => !n.trashed)
      if (this.selectedNoteId && !this.notes.find((n) => n.id === this.selectedNoteId)) {
        this.selectedNoteId = null
      }
      trashedIds.forEach(deleteNoteFile)
    },

    createFolder(name) {
      const folder = { id: uuid(), name: name?.trim() || t('common.newFolder'), createdAt: Date.now() }
      this.folders.push(folder)
      saveFoldersNow(this.folders)
      return folder
    },

    // L'ordine delle cartelle e' l'ordine dell'array: api.saveFolders
    // persiste la sequenza cosi' com'e', quindi non serve un campo "order".
    reorderFolders(fromIndex, toIndex) {
      const last = this.folders.length - 1
      if (
        fromIndex === toIndex ||
        fromIndex < 0 || fromIndex > last ||
        toIndex < 0 || toIndex > last
      ) {
        return
      }
      const [moved] = this.folders.splice(fromIndex, 1)
      this.folders.splice(toIndex, 0, moved)
      saveFoldersNow(this.folders)
    },

    renameFolder(id, name) {
      const folder = this.folders.find((f) => f.id === id)
      if (!folder || !name?.trim()) return
      folder.name = name.trim()
      saveFoldersNow(this.folders)
    },

    deleteFolder(id) {
      const affected = this.notes.filter((n) => n.folderId === id)
      affected.forEach((n) => {
        n.trashed = true
        n.updatedAt = Date.now()
      })
      this.folders = this.folders.filter((f) => f.id !== id)
      if (this.selectedFolderId === id) {
        this.selectFolder(ALL)
      }
      saveFoldersNow(this.folders)
      affected.forEach(saveNoteNow)
    }
  }
})
