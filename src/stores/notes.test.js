import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../utils/api', () => ({
  api: {
    loadData: vi.fn(),
    saveNote: vi.fn(() => Promise.resolve(true)),
    deleteNoteFile: vi.fn(() => Promise.resolve(true)),
    saveFolders: vi.fn(() => Promise.resolve(true))
  }
}))

import { api } from '../utils/api'
import { useNotesStore } from './notes'

const note = (id, extra = {}) => ({
  id,
  title: id,
  content: `<h1>${id}</h1>`,
  folderId: null,
  pinned: false,
  trashed: false,
  createdAt: 1,
  updatedAt: 1,
  ...extra
})

describe('notes store', () => {
  let store

  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    api.loadData.mockResolvedValue({
      folders: [{ id: 'f1', name: 'Lavoro', createdAt: 1 }],
      notes: [note('a', { updatedAt: 3 }), note('b', { folderId: 'f1', updatedAt: 2 }), note('c', { trashed: true })]
    })
    store = useNotesStore()
    await store.init()
  })

  it('all avvio seleziona la vista Tutte e la prima nota visibile', () => {
    expect(store.isAllView).toBe(true)
    expect(store.visibleNotes.map((n) => n.id)).toEqual(['a', 'b'])
    expect(store.selectedNoteId).toBe('a')
    expect(store.trashCount).toBe(1)
  })

  it('createNote dalla vista Tutte crea una nota senza cartella e la salva subito', () => {
    const created = store.createNote()
    expect(created.folderId).toBeNull()
    expect(store.selectedFolderId).toBe('all')
    expect(store.selectedNoteId).toBe(created.id)
    expect(api.saveNote).toHaveBeenCalledWith(expect.objectContaining({ id: created.id }))
  })

  it('createNote da una cartella la assegna a quella cartella', () => {
    store.selectFolder('f1')
    const created = store.createNote()
    expect(created.folderId).toBe('f1')
  })

  it('updateNote deduce il titolo dal contenuto e salva con debounce', () => {
    vi.useFakeTimers()
    store.updateNote('a', { content: '<p>x</p><h2>Nuovo titolo</h2>' })
    expect(store.notes.find((n) => n.id === 'a').title).toBe('Nuovo titolo')
    expect(api.saveNote).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    expect(api.saveNote).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('trashNote sposta la selezione sulla nota successiva', () => {
    store.trashNote('a')
    expect(store.notes.find((n) => n.id === 'a').trashed).toBe(true)
    expect(store.selectedNoteId).toBe('b')
  })

  it('moveNotesToFolder fuori dalla vista corrente cambia la selezione', () => {
    store.selectFolder('f1')
    expect(store.selectedNoteId).toBe('b')
    store.moveNotesToFolder(['b'], null)
    expect(store.visibleNotes).toEqual([])
    expect(store.selectedNoteId).toBeNull()
  })

  it('deleteFolder cestina le note contenute e torna a Tutte', () => {
    store.selectFolder('f1')
    store.deleteFolder('f1')
    expect(store.folders).toEqual([])
    expect(store.notes.find((n) => n.id === 'b').trashed).toBe(true)
    expect(store.isAllView).toBe(true)
    expect(api.saveFolders).toHaveBeenCalled()
  })

  it('i preferiti restano in cima a prescindere dall ordinamento', () => {
    store.togglePin('b')
    expect(store.visibleNotes.map((n) => n.id)).toEqual(['b', 'a'])
  })

  it('emptyTrash elimina i file delle note cestinate', () => {
    store.emptyTrash()
    expect(store.notes.map((n) => n.id)).toEqual(['a', 'b'])
    expect(api.deleteNoteFile).toHaveBeenCalledWith('c')
  })
})
