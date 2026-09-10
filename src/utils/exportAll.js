// Esporta tutte le note (cestino escluso) come file Markdown in una cartella
// scelta dall'utente, una sottocartella per cartella dell'app. La conversione
// HTML -> Markdown avviene qui con lo stesso convertitore dell'export singolo
// (utils/markdown.js), cosi' i due percorsi producono lo stesso risultato;
// Rust si occupa solo di scrivere i file e risolvere i nomi duplicati.
import { htmlToMarkdown } from './markdown'
import { api } from './api'

export function buildExportFiles(notes, folders) {
  const folderName = new Map(folders.map((f) => [f.id, f.name]))
  return notes
    .filter((n) => !n.trashed)
    .map((n) => ({
      folder: folderName.get(n.folderId) ?? null,
      name: n.title?.trim() || '',
      markdown: htmlToMarkdown(n.content || '')
    }))
}

// Ritorna { dir, count } oppure null se l'utente annulla il dialogo.
export async function exportAllNotes(notes, folders) {
  const files = buildExportFiles(notes, folders)
  if (!files.length) return { count: 0, dir: null }
  return api.exportAllMarkdown(files)
}
