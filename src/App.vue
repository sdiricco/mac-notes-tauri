<template>
  <div v-if="!store.ready" class="loading">
    <Icon icon="lucide:loader-circle" class="spin" />
  </div>
  <template v-else>
    <!-- Layout a larghezze fisse in pixel invece del Splitter di PrimeVue.
         Motivo: PrimeVue ridimensiona sempre *la coppia* di pannelli adiacenti
         conservandone la somma, quindi trascinando il divisorio di sinistra
         cambiavano per forza sia sidebar sia lista. Qui ogni divisorio muove
         solo il pannello che ha a sinistra e l'editor assorbe la differenza,
         come in Mail/Note di macOS. In più i vincoli sono veri pixel: in
         percentuale il minimo della sidebar valeva ~98px a finestra stretta
         e ~260px a schermo intero, cioè non era un vincolo utile. -->
    <div class="app-shell">
      <div
        v-show="ui.sidebarVisible"
        class="pane sidebar-panel"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <Sidebar @toggle-sidebar="ui.toggleSidebar()" />
      </div>
      <div
        v-show="ui.sidebarVisible"
        class="divider"
        role="separator"
        aria-orientation="vertical"
        aria-label="Ridimensiona la barra laterale"
        @mousedown="startDrag('sidebar', $event)"
        @dblclick="resetPane('sidebar')"
      ></div>

      <div class="pane" :style="{ width: listWidth + 'px' }">
        <NoteList ref="noteListRef" :sidebar-visible="ui.sidebarVisible" @toggle-sidebar="ui.toggleSidebar()" />
      </div>
      <div
        class="divider"
        role="separator"
        aria-orientation="vertical"
        aria-label="Ridimensiona la lista delle note"
        @mousedown="startDrag('list', $event)"
        @dblclick="resetPane('list')"
      ></div>

      <div class="pane editor-pane">
        <NoteEditor />
      </div>
    </div>

    <SettingsDialog />
    <ShortcutsDialog />
  </template>

  <ConfirmDialog />
  <Toast position="top-right" />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import ConfirmDialog from 'primevue/confirmdialog'
import Toast from 'primevue/toast'
import { Icon } from '@iconify/vue'
import Sidebar from './components/Sidebar.vue'
import NoteList from './components/NoteList.vue'
import NoteEditor from './components/NoteEditor.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import ShortcutsDialog from './components/ShortcutsDialog.vue'
import { useNotesStore } from './stores/notes'
import { useSettingsStore } from './stores/settings'
import { useUiStore } from './stores/ui'
import { useUpdateCheckStore } from './stores/updateCheck'
import { api } from './utils/api'

const store = useNotesStore()
const settings = useSettingsStore()
const ui = useUiStore()
const updateCheck = useUpdateCheckStore()
const noteListRef = ref(null)
const unsubscribers = []

// Vincoli in pixel dei due pannelli a larghezza fissa. L'editor non ha una
// larghezza propria (flex: 1): assorbe tutto lo spazio restante, quindi il
// suo minimo va imposto qui come tetto agli altri due — senza, trascinando
// si potrebbe schiacciarlo a zero.
const PANES = {
  sidebar: { min: 180, max: 340, default: 220 },
  list: { min: 240, max: 520, default: 320 }
}
// 380 e non di più: i tre minimi sommati devono stare nella larghezza minima
// della finestra (820px, vedi tauri.conf.json) — 180 + 240 + 380 + 2 divisori
// = 802px. Alzandolo a 420 si sforava di 36px e a finestra stretta l'editor
// veniva tagliato invece di rispettare il proprio minimo.
const EDITOR_MIN = 380
// Larghezza del divisorio *nel layout*: 1px. L'area afferrabile è più larga
// (9px) ma è un overlay in position:absolute, che non occupa spazio — vedi
// .divider::after nel CSS. Qui serve quella di layout, per i calcoli.
const DIVIDER = 1

const sidebarWidth = ref(PANES.sidebar.default)
const listWidth = ref(PANES.list.default)

// Limite superiore effettivo: il massimo preferito, ma non oltre lo spazio
// che resta lasciando all'editor il suo minimo. Ricalcolato a ogni
// movimento perché dipende dalla larghezza corrente della finestra e
// dell'altro pannello.
function maxFor(pane) {
  const dividers = ui.sidebarVisible ? DIVIDER * 2 : DIVIDER
  const other = pane === 'sidebar' ? listWidth.value : (ui.sidebarVisible ? sidebarWidth.value : 0)
  const available = window.innerWidth - other - dividers - EDITOR_MIN
  return Math.min(PANES[pane].max, available)
}

function clamp(pane, value) {
  return Math.max(PANES[pane].min, Math.min(maxFor(pane), value))
}

let drag = null

function startDrag(pane, event) {
  event.preventDefault() // impedisce la selezione del testo durante il trascinamento
  const current = pane === 'sidebar' ? sidebarWidth.value : listWidth.value
  drag = { pane, startX: event.clientX, startWidth: current }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', endDrag)
  document.body.classList.add('is-resizing')
}

function onDrag(event) {
  if (!drag) return
  const next = clamp(drag.pane, drag.startWidth + (event.clientX - drag.startX))
  if (drag.pane === 'sidebar') sidebarWidth.value = next
  else listWidth.value = next
}

function endDrag() {
  drag = null
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', endDrag)
  document.body.classList.remove('is-resizing')
}

// Doppio click sul divisorio: torna alla larghezza di partenza, come fanno
// molti editor. Costa due righe e evita di restare incastrati in una
// larghezza scomoda.
function resetPane(pane) {
  const next = clamp(pane, PANES[pane].default)
  if (pane === 'sidebar') sidebarWidth.value = next
  else listWidth.value = next
}

// Rimpicciolendo la finestra i due pannelli fissi resterebbero larghi come
// prima, mangiando lo spazio dell'editor fino a farlo sparire: qui si
// ri-applicano i limiti, che dipendono da window.innerWidth.
function onWindowResize() {
  listWidth.value = clamp('list', listWidth.value)
  sidebarWidth.value = clamp('sidebar', sidebarWidth.value)
}

onMounted(async () => {
  window.addEventListener('resize', onWindowResize)
  settings.init()
  updateCheck.init()
  // allinea la spunta dei radio "Vista > Toolbar" alla preferenza persistita
  api.syncToolbarMode(settings.toolbarMode)
  await store.init()

  unsubscribers.push(
    api.onMenu('menu:new-note', () => store.createNote()),
    api.onMenu('menu:new-folder', () => {
      const folder = store.createFolder('Nuova cartella')
      store.selectFolder(folder.id)
    }),
    api.onMenu('menu:duplicate-note', () => {
      if (store.selectedNoteId) store.duplicateNote(store.selectedNoteId)
    }),
    api.onMenu('menu:focus-search', () => noteListRef.value?.focusSearch()),
    api.onMenu('menu:toggle-sidebar', () => ui.toggleSidebar()),
    api.onMenu('menu:settings', () => ui.openSettings()),
    api.onMenu('menu:shortcuts', () => ui.openShortcuts()),
    api.onMenu('menu:toolbar-mode', (mode) => settings.setToolbarMode(mode))
  )
})

onBeforeUnmount(() => {
  unsubscribers.forEach((off) => off())
  window.removeEventListener('resize', onWindowResize)
  endDrag() // se si smonta a trascinamento in corso, i listener globali vanno rimossi
})
</script>

<style>
.loading {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  color: var(--icon-color);
  -webkit-app-region: drag;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.app-shell {
  height: 100vh;
  display: flex;
  overflow: hidden;
}

/* I due pannelli a sinistra hanno una larghezza esplicita in px (inline);
   flex-shrink: 0 impedisce a flexbox di restringerli comunque, altrimenti il
   vincolo minimo verrebbe aggirato a finestra stretta. */
.pane {
  flex: 0 0 auto;
  overflow: hidden;
  min-width: 0;
}

/* L'editor è l'unico elastico: assorbe tutto lo spazio residuo, così
   trascinando un divisorio cambia solo il pannello alla sua sinistra. */
.editor-pane {
  flex: 1 1 0;
  min-width: 0;
}

.sidebar-panel {
  background: var(--sidebar-bg);
}

/* Il divisorio occupa 1px nel layout — è lui la linea di separazione, non i
   pannelli (il border-right di .note-list è stato rimosso: con un divisorio
   più spesso si vedevano due righe distanziate). L'area afferrabile è invece
   larga 9px grazie all'overlay ::after, che essendo in position:absolute
   sborda sui pannelli adiacenti senza occupare spazio nel layout: così non
   si creano né spazi vuoti né doppie linee, ma il bersaglio resta comodo (a
   1px era quasi impossibile da centrare col mouse).
   no-drag è necessario perché in alto il divisorio confina con gli header di
   Sidebar/NoteList/NoteEditor, che hanno -webkit-app-region: drag: senza,
   un click lì sposterebbe la finestra invece di ridimensionare. */
.divider {
  flex: 0 0 1px;
  position: relative;
  z-index: 5; /* l'overlay deve stare sopra i pannelli per ricevere il mouse */
  background: var(--p-content-border-color);
  cursor: col-resize;
  -webkit-app-region: no-drag;
}
.divider::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -4px;
  right: -4px;
  cursor: col-resize;
}
/* Nessun cambio di colore su hover né durante il trascinamento: il cursore
   col-resize è già segnale sufficiente, e illuminare una linea a tutta
   altezza è troppo rumoroso. */

/* Durante il trascinamento il cursore resta col-resize su tutta la finestra
   (anche se il puntatore esce dal divisorio) e nulla intercetta gli eventi:
   senza, passando sopra editor o lista il cursore cambierebbe e la
   selezione del testo partirebbe. */
body.is-resizing {
  cursor: col-resize;
  user-select: none;
}
body.is-resizing iframe,
body.is-resizing .ql-editor {
  pointer-events: none;
}

/* Toast: card scura in linea con l'app (stessa identità delle altre card
   flottanti) invece del verde/rosso/blu piatto di default di PrimeVue.
   La severità resta leggibile da un piccolo accento a sinistra e dal colore
   dell'icona, non da uno sfondo colorato a piena tinta. */
.p-toast {
  width: 22rem;
}
.p-toast-message {
  background: var(--editor-toolbar-bg);
  border: 1px solid var(--p-content-border-color);
  border-left: 3px solid var(--icon-color);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
  color: var(--p-text-color);
  margin-bottom: 8px;
  overflow: hidden;
}
.p-toast-message-content {
  padding: 10px 12px;
  align-items: flex-start;
}
.p-toast-message-success {
  border-left-color: #3ba55d;
}
.p-toast-message-success .p-toast-message-icon {
  color: #3ba55d;
}
.p-toast-message-info {
  border-left-color: #3b82f6;
}
.p-toast-message-info .p-toast-message-icon {
  color: #3b82f6;
}
.p-toast-message-warn {
  border-left-color: #f59e0b;
}
.p-toast-message-warn .p-toast-message-icon {
  color: #f59e0b;
}
.p-toast-message-error {
  border-left-color: #e5484d;
}
.p-toast-message-error .p-toast-message-icon {
  color: #e5484d;
}
.p-toast-message-text {
  margin-left: 10px;
}
.p-toast-summary {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
}
.p-toast-detail {
  margin-top: 3px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.p-toast-close-button {
  color: var(--icon-color);
  background: transparent;
}
.p-toast-close-button:hover {
  background: var(--sidebar-hover-bg);
  color: var(--p-text-color);
}
</style>
