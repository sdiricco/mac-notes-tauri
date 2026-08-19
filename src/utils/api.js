// Porting di api.js: stessa forma esportata (`api.loadData()`, `api.saveNote()`,
// ecc.), stessi nomi di canale per gli eventi menu — solo il trasporto cambia,
// da `window.api` (contextBridge di Electron) a `invoke`/`listen` di Tauri.
// Nessun altro file del frontend ha dovuto cambiare per via di questo switch.

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

// `listen()` è asincrono (ritorna una Promise<UnlistenFn>), ma tutti i
// chiamanti in questo progetto si aspettano una funzione di cleanup
// *sincrona* (com'era con ipcRenderer.on). Questo helper conserva quel
// contratto: se il cleanup arriva prima che listen() si risolva, si limita a
// annullare la sottoscrizione appena pronta invece di perderla.
function bridgeEvent(channel, callback) {
  let unlisten = null
  let cancelled = false
  listen(channel, (event) => callback(event.payload)).then((fn) => {
    if (cancelled) fn()
    else unlisten = fn
  })
  return () => {
    cancelled = true
    if (unlisten) unlisten()
  }
}

const MENU_CHANNELS = [
  'menu:new-note',
  'menu:new-folder',
  'menu:duplicate-note',
  'menu:focus-search',
  'menu:toggle-sidebar',
  'menu:settings',
  'menu:shortcuts',
  'menu:toolbar-mode'
]

export const api = {
  loadData: () => invoke('store_load'),
  saveNote: (note) => invoke('store_save_note', { note }),
  deleteNoteFile: (id) => invoke('store_delete_note', { id }),
  saveFolders: (folders) => invoke('store_save_folders', { folders }),

  onMenu: (channel, callback) => {
    if (!MENU_CHANNELS.includes(channel)) return () => {}
    return bridgeEvent(channel, callback)
  },

  syncToolbarMode: (mode) => invoke('menu_sync_toolbar_mode', { mode }),
  checkForUpdates: () => invoke('update_check_run'),
  getAppVersion: () => invoke('update_check_app_version'),
  onUpdateCheckStatus: (callback) => bridgeEvent('update-check:status', callback),

  exportMarkdown: (markdown, suggestedName) =>
    invoke('export_md', { markdown, suggestedName }),
  importMarkdown: () => invoke('import_md'),
  pickImage: () => invoke('pick_image'),
  readLocalImage: (filePath) => invoke('read_local_image', { filePath }),
  revealDataFile: () => invoke('store_reveal_in_finder')
}
