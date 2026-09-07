<template>
  <div v-if="!store.ready" class="loading" data-tauri-drag-region="deep">
    <Icon icon="lucide:loader-circle" class="spin" />
  </div>
  <template v-else>
    <div class="app-root">
      <AppHeader
        ref="appHeaderRef"
        :sidebar-visible="ui.sidebarVisible"
        :narrow="isNarrow"
        @toggle-sidebar="ui.toggleSidebar()"
      />

      <!-- Layout a larghezze fisse in pixel invece del Splitter di PrimeVue.
           Motivo: PrimeVue ridimensiona sempre *la coppia* di pannelli adiacenti
           conservandone la somma, quindi trascinando il divisorio di sinistra
           cambiavano per forza sia sidebar sia lista. Qui ogni divisorio muove
           solo il pannello che ha a sinistra e l'editor assorbe la differenza,
           come in Mail/Note di macOS. In più i vincoli sono veri pixel: in
           percentuale il minimo della sidebar valeva ~98px a finestra stretta
           e ~260px a schermo intero, cioè non era un vincolo utile. -->
      <div class="app-shell">
        <!-- Cartelle + lista note insieme: sopra DRAWER_BELOW questo wrapper è
             `display: contents`, quindi i suoi figli restano flex item della
             shell e il layout a tre pannelli è esattamente quello di prima.
             Sotto la soglia diventa un cassetto sovrapposto che li contiene
             entrambi, lasciando all'editor tutta la larghezza.
             Un wrapper e non due elementi alternativi: spostare i componenti
             in un altro punto del template li rimonterebbe, perdendo lo stato
             locale (una rinomina in corso, una cartella in creazione). -->
        <div
          v-show="!isNarrow || ui.sidebarVisible"
          class="browse"
          :class="{ 'is-drawer': isNarrow }"
        >
          <!-- Nel cassetto le cartelle ci sono sempre: e' il cassetto intero
               che si apre e chiude. Nel flusso, invece, il tasto nasconde
               queste lasciando la lista al suo posto. -->
          <div
            v-show="isNarrow || ui.sidebarVisible"
            class="pane sidebar-panel"
            :style="isNarrow ? null : { width: sidebarWidth + 'px' }"
          >
            <Sidebar />
          </div>
          <!-- I divisori servono solo nel flusso: nel cassetto le larghezze
               sono fisse e non c'è nulla da trascinare. -->
          <div
            v-show="sidebarInLayout"
            class="divider"
            role="separator"
            aria-orientation="vertical"
            aria-label="Ridimensiona la barra laterale"
            @mousedown="startDrag('sidebar', $event)"
            @dblclick="resetPane('sidebar')"
          ></div>

          <div class="pane list-panel" :style="isNarrow ? null : { width: listWidth + 'px' }">
            <NoteList />
          </div>
        </div>

        <div
          v-show="!isNarrow"
          class="divider"
          role="separator"
          aria-orientation="vertical"
          aria-label="Ridimensiona la lista delle note"
          @mousedown="startDrag('list', $event)"
          @dblclick="resetPane('list')"
        ></div>

        <!-- Velo: chiude il cassetto cliccando sull'editor, che altrimenti
             resterebbe coperto senza un modo ovvio di tornare. -->
        <div
          v-if="isNarrow && ui.sidebarVisible"
          class="drawer-backdrop"
          @click="ui.toggleSidebar()"
        ></div>

        <div class="pane editor-pane">
          <NoteEditor />
        </div>
      </div>
    </div>

    <SettingsDialog />
    <ShortcutsDialog />
  </template>

  <ConfirmDialog />
  <Toast position="top-right" />
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ConfirmDialog from 'primevue/confirmdialog'
import Toast from 'primevue/toast'
import { Icon } from '@iconify/vue'
import AppHeader from './components/AppHeader.vue'
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
const appHeaderRef = ref(null)
const unsubscribers = []

// Vincoli in pixel dei due pannelli a larghezza fissa. L'editor non ha una
// larghezza propria (flex: 1): assorbe tutto lo spazio restante, quindi il
// suo minimo va imposto qui come tetto agli altri due — senza, trascinando
// si potrebbe schiacciarlo a zero.
const PANES = {
  sidebar: { min: 180, max: 340, default: 220 },
  list: { min: 240, max: 520, default: 320 }
}
// 380 e non di più: da DRAWER_BELOW in su i tre pannelli stanno nel flusso e
// i loro minimi sommati devono starci — 180 + 240 + 380 + 2 divisori = 802px,
// contro gli 820 della soglia. Alzandolo si taglierebbe l'editor invece di
// fargli rispettare il minimo (con 420 si sforava).
const EDITOR_MIN = 380
// Sotto questa larghezza cartelle e lista escono dal flusso e si aprono
// insieme in un cassetto sovrapposto, lasciando all'editor tutta la
// larghezza. 820 non e' arbitrario: e' la soglia sotto la quale i tre
// pannelli nel flusso non stanno piu' nei loro minimi (180 + 240 + 380 + 2
// divisori = 802px). Con un valore piu' basso ci sarebbe una fascia in cui
// restano tutti nel flusso senza spazio a sufficienza, e l'editor verrebbe
// schiacciato sotto il proprio minimo. Sotto la soglia nel flusso resta solo
// l'editor (380px), ed e' cio' che permette alla finestra di scendere a 660
// (vedi minWidth in tauri.conf.json).
const DRAWER_BELOW = 820

const isNarrow = ref(false)
// La sidebar occupa spazio nel layout solo se e' visibile E non sovrapposta:
// da sovrapposta e' in position:absolute e non entra nei calcoli.
// Le cartelle occupano spazio nel layout solo a finestra larga e con il
// pannello aperto: nel cassetto sono in position:absolute e non entrano nei
// calcoli. La lista, invece, e' nel flusso ogni volta che non c'e' il
// cassetto.
const listInLayout = computed(() => !isNarrow.value)
const sidebarInLayout = computed(() => !isNarrow.value && ui.sidebarVisible)
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
  const dividers = (sidebarInLayout.value ? DIVIDER : 0) + (listInLayout.value ? DIVIDER : 0)
  const other =
    pane === 'sidebar' ? listWidth.value : (sidebarInLayout.value ? sidebarWidth.value : 0)
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
  const narrow = window.innerWidth < DRAWER_BELOW
  // Entrando in modalita' sovrapposta la sidebar va chiusa: restando aperta
  // coprirebbe il contenuto proprio nel momento in cui lo spazio scarseggia.
  // Uscendone si riapre, tornando allo stato atteso a finestra larga.
  if (narrow !== isNarrow.value) {
    isNarrow.value = narrow
    if (narrow === ui.sidebarVisible) ui.toggleSidebar()
  }
  // A cassetto attivo ne' cartelle ne' lista sono nel flusso: le larghezze
  // trascinabili non sono applicate, e vincolarle sulla finestra stretta le
  // schiaccerebbe ai minimi per poi ritrovarle tali tornando larghi.
  if (listInLayout.value) {
    listWidth.value = clamp('list', listWidth.value)
    sidebarWidth.value = clamp('sidebar', sidebarWidth.value)
  }
}

// Si chiude scegliendo una NOTA, non una cartella: la lista vive dentro il
// cassetto, quindi dopo aver scelto la cartella si deve poter scegliere la
// nota. E' l'apertura della nota a voler l'editor libero.
watch(
  () => store.selectedNoteId,
  () => {
    if (isNarrow.value && ui.sidebarVisible) ui.toggleSidebar()
  }
)

function onKeydown(event) {
  if (event.key === 'Escape' && isNarrow.value && ui.sidebarVisible) ui.toggleSidebar()
}

onMounted(async () => {
  window.addEventListener('resize', onWindowResize)
  window.addEventListener('keydown', onKeydown)
  onWindowResize() // stato iniziale: la finestra puo' partire gia' stretta
  settings.init()
  updateCheck.init()
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
    api.onMenu('menu:search-all', () => appHeaderRef.value?.openSearch()),
    api.onMenu('menu:toggle-sidebar', () => ui.toggleSidebar()),
    api.onMenu('menu:settings', () => ui.openSettings()),
    api.onMenu('menu:shortcuts', () => ui.openShortcuts())
  )
})

onBeforeUnmount(() => {
  unsubscribers.forEach((off) => off())
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('keydown', onKeydown)
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
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* L'header occupa la sua altezza, i pannelli il resto: la shell non e' piu
   alta 100vh ma quello che rimane sotto la barra. */
.app-root {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-shell {
  position: relative; /* origine per la sidebar sovrapposta e il suo velo */
  flex: 1;
  min-height: 0;
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

/* display: contents -> il wrapper non genera una box: cartelle, divisorio e
   lista restano flex item diretti della shell, con le loro larghezze inline.
   E' cio' che permette di avere un solo albero DOM per le due modalita'. */
.browse {
  display: contents;
}

/* Cassetto (finestra stretta): fuori dal flusso, quindi l'editor si prende
   tutta la larghezza come se cartelle e lista non esistessero.
   z-index sopra i divisori (che stanno a 5) e sopra il velo (15). */
.browse.is-drawer {
  display: flex;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  /* min() e non una larghezza fissa: a 660px di finestra (il minimo) un
     cassetto da 520 lascerebbe appena 140px di editor dietro al velo. */
  width: min(520px, 84%);
  z-index: 20;
  box-shadow: 2px 0 16px rgba(0, 0, 0, 0.28);
  border-right: 1px solid var(--p-content-border-color);
}
/* Dentro il cassetto le larghezze inline non ci sono (vedi :style nel
   template): le cartelle restano fisse e la lista prende il resto. */
.browse.is-drawer > .sidebar-panel {
  flex: 0 0 200px;
}
.browse.is-drawer > .list-panel {
  flex: 1 1 0;
  min-width: 0;
}

.drawer-backdrop {
  position: absolute;
  inset: 0;
  z-index: 15;
  background: rgba(0, 0, 0, 0.28);
}

/* Il divisorio occupa 1px nel layout — è lui la linea di separazione, non i
   pannelli (il border-right di .note-list è stato rimosso: con un divisorio
   più spesso si vedevano due righe distanziate). L'area afferrabile è invece
   larga 9px grazie all'overlay ::after, che essendo in position:absolute
   sborda sui pannelli adiacenti senza occupare spazio nel layout: così non
   si creano né spazi vuoti né doppie linee, ma il bersaglio resta comodo (a
   1px era quasi impossibile da centrare col mouse).
   Non serve escluderlo dalle aree di trascinamento della finestra: quelle
   sono dichiarate con data-tauri-drag-region sui singoli header, e il
   divisorio non ne fa parte. */
.divider {
  flex: 0 0 1px;
  position: relative;
  z-index: 5; /* l'overlay deve stare sopra i pannelli per ricevere il mouse */
  background: var(--p-content-border-color);
  cursor: col-resize;
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
