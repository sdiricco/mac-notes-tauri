// Porting di api.js: stessa forma esportata (`api.loadData()`, `api.saveNote()`,
// ecc.), stessi nomi di canale per gli eventi menu — solo il trasporto cambia,
// da `window.api` (contextBridge di Electron) a `invoke`/`listen` di Tauri.
// Nessun altro file del frontend ha dovuto cambiare per via di questo switch.

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { t } from '../i18n'

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
  'menu:find-in-note',
  'menu:search-all',
  'menu:toggle-sidebar',
  'menu:settings',
  'menu:shortcuts',
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

  checkForUpdates: () => invoke('update_check_run'),
  getAppVersion: () => invoke('update_check_app_version'),
  onUpdateCheckStatus: (callback) => bridgeEvent('update-check:status', callback),

  // I dialoghi nativi vivono in Rust, fuori da vue-i18n: il titolo viene
  // tradotto qui e passato come parametro, cosi' i componenti non se ne
  // occupano e il menu/dialogo segue la lingua dell'app.
  exportMarkdown: (markdown, suggestedName) =>
    invoke('export_md', { markdown, suggestedName, title: t('app.dialogs.exportMarkdown') }),
  // files: [{ folder: string|null, name: string, markdown: string }]
  exportAllMarkdown: (files) =>
    invoke('export_all_md', {
      files,
      title: t('app.dialogs.exportAll'),
      fallbackName: t('common.untitledNote')
    }),
  importMarkdown: () => invoke('import_md', { title: t('app.dialogs.importMarkdown') }),
  pickImage: () =>
    invoke('pick_image', {
      title: t('app.dialogs.pickImage'),
      filterLabel: t('app.dialogs.imagesFilter')
    }),
  readLocalImage: (filePath) => invoke('read_local_image', { filePath }),
  revealDataFile: () => invoke('store_reveal_in_finder'),

  // Cartella dati a scelta dell'utente (Impostazioni > Informazioni > Dati).
  getDataDirInfo: () => invoke('store_data_dir_info'),
  pickFolder: () => invoke('pick_folder', { title: t('app.dialogs.chooseDataDir') }),
  inspectDir: (path) => invoke('store_inspect_dir', { path }),
  // path null = torna alla predefinita. Risposta: { dir, mode: 'moved'|'adopted'|'unchanged' }
  setDataDir: (path) => invoke('store_set_data_dir', { path }),

  // Zoom dell'interfaccia: la logica (passo, limiti, persistenza) sta in
  // Rust (zoom.rs), condivisa col menu nativo. Ogni chiamata ritorna il
  // fattore effettivo; onZoomChanged arriva anche per lo zoom dal menu.
  zoomGet: () => invoke('zoom_get'),
  zoomIn: () => invoke('zoom_in'),
  zoomOut: () => invoke('zoom_out'),
  zoomReset: () => invoke('zoom_reset'),
  onZoomChanged: (callback) => bridgeEvent('zoom:changed', callback)
}
