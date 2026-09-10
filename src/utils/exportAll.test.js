import { describe, it, expect } from 'vitest'
import { buildExportFiles } from './exportAll'

describe('buildExportFiles', () => {
  const folders = [{ id: 'f1', name: 'Lavoro' }]
  const notes = [
    { id: '1', title: 'Idea', content: '<h1>Idea</h1><p>testo</p>', folderId: 'f1', trashed: false },
    { id: '2', title: '', content: '<p>senza titolo</p>', folderId: null, trashed: false },
    { id: '3', title: 'Cestinata', content: '<p>x</p>', folderId: 'f1', trashed: true },
    { id: '4', title: 'Orfana', content: '<p>y</p>', folderId: 'sparita', trashed: false }
  ]

  it('esclude il cestino e converte in markdown', () => {
    const files = buildExportFiles(notes, folders)
    expect(files.map((f) => f.name)).toEqual(['Idea', '', 'Orfana'])
    expect(files[0]).toEqual({ folder: 'Lavoro', name: 'Idea', markdown: '# Idea\n\ntesto' })
  })

  it('note senza cartella o con cartella inesistente vanno nella radice', () => {
    const files = buildExportFiles(notes, folders)
    expect(files[1].folder).toBeNull()
    expect(files[2].folder).toBeNull()
  })
})
