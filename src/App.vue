<template>
  <div v-if="!store.ready" class="loading" data-tauri-drag-region="deep">
    <Icon icon="lucide:loader-circle" class="spin" />
  </div>
  <template v-else>
    <!-- app-root e' una RIGA: cartelle e lista stanno "dalla testa ai piedi"
         a sinistra, e l'header vive nella colonna di destra sopra il solo
         editor. Prima era una colonna con l'header a tutta larghezza sopra
         tutto. -->
    <div class="app-root">
      <!-- Larghezza in pixel e non in percentuale: in percentuale il minimo
           del pannello valeva ~98px a finestra stretta e ~260px a schermo
           intero, cioe' non era un vincolo utile. -->
        <!-- I semafori della finestra sono disegnati in alto a sinistra, che e'
           sopra il pannello laterale e non sopra l'header: questa striscia
           lascia loro lo spazio ed e' l'area con cui si sposta la finestra da
           questo lato. Larga solo la zona dei semafori, non tutto il
           pannello: la banda contiene i pulsanti della vista, e coprirli li
           renderebbe inerti. -->
      <div
        v-if="sidebarInLayout"
        class="browse-drag"
        data-tauri-drag-region="deep"
      ></div>

      <!-- UN SOLO pannello laterale con due viste alternative: note (di
           default) e cartelle, come in un master-detail. Prima erano due
           pannelli affiancati, ognuno con la sua larghezza e il suo
           divisorio.
           v-if e non v-show: cambiare vista e' una navigazione esplicita,
           quindi perdere lo stato locale (una rinomina a metà) e' corretto,
           e tenere montati entrambi costerebbe due liste sempre vive. -->
      <div
        v-show="ui.sidebarVisible"
        class="pane sidebar-panel"
        :class="{ 'is-drawer': isNarrow, 'folders-view': ui.sidebarView === 'folders' }"
        :style="isNarrow ? null : { width: sidebarWidth + 'px' }"
      >
        <Sidebar v-if="ui.sidebarView === 'folders'" />
        <NoteList v-else ref="noteListRef" />
      </div>

      <!-- Un solo divisorio: c'e' un solo pannello da ridimensionare. -->
      <div
        v-show="sidebarInLayout"
        class="divider"
        role="separator"
        aria-orientation="vertical"
        :aria-label="$t('app.resizeSidebar')"
        @mousedown="startDrag($event)"
        @dblclick="resetPane()"
      ></div>

      <!-- Velo: chiude il pannello sovrapposto cliccando sull'editor, che
           altrimenti resterebbe coperto senza un modo ovvio di tornare. -->
      <div
        v-if="isNarrow && ui.sidebarVisible"
        class="drawer-backdrop"
        @click="ui.toggleSidebar()"
      ></div>

        <!-- Colonna di destra: l'header sta qui, non sopra tutto, così le
             cartelle arrivano fino in cima alla finestra. -->
        <div class="main-col">
          <AppHeader
            :sidebar-visible="ui.sidebarVisible"
            :browse-in-layout="sidebarInLayout"
            @toggle-sidebar="ui.toggleSidebar()"
          />
          <div class="pane editor-pane">
            <NoteEditor />
          </div>
        </div>
    </div>

    <SettingsPage />
  </template>

  <ConfirmDialog />
  <Toast position="top-right" />
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ConfirmDialog from 'primevue/confirmdialog'
import Toast from 'primevue/toast'
import { Icon } from '@iconify/vue'
import AppHeader from './components/AppHeader.vue'
import Sidebar from './components/Sidebar.vue'
import NoteList from './components/NoteList.vue'
import NoteEditor from './components/NoteEditor.vue'
import SettingsPage from './components/SettingsPage.vue'
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

// Vincoli in pixel del pannello laterale. L'editor non ha una larghezza
// propria (flex: 1): assorbe lo spazio restante, quindi il suo minimo va
// imposto qui come tetto al pannello — senza, trascinando si potrebbe
// schiacciarlo a zero.
const SIDEBAR = { min: 240, max: 420, default: 300 }
const EDITOR_MIN = 380
// Larghezza del divisorio *nel layout*: 1px. L'area afferrabile e' piu' larga
// (9px) ma e' un overlay in position:absolute, che non occupa spazio — vedi
// .divider::after nel CSS.
const DIVIDER = 1

// Sotto questa larghezza il pannello esce dal flusso e si apre sovrapposto,
// lasciando all'editor tutta la larghezza. 640 non e' arbitrario: e' la
// soglia sotto la quale pannello ed editor non stanno piu' nei loro minimi
// (240 + 1 + 380 = 621). Con un valore piu' basso ci sarebbe una fascia in
// cui restano entrambi nel flusso senza spazio, e l'editor verrebbe
// schiacciato sotto il proprio minimo.
const DRAWER_BELOW = 640

const isNarrow = computed(() => ui.narrow)
// Occupa spazio nel layout solo se visibile E non sovrapposto: da
// sovrapposto e' in position:absolute e non entra nei calcoli.
const sidebarInLayout = computed(() => !isNarrow.value && ui.sidebarVisible)

const sidebarWidth = ref(SIDEBAR.default)

// Limite superiore effettivo: il massimo preferito, ma non oltre lo spazio
// che resta lasciando all'editor il suo minimo. Ricalcolato a ogni movimento
// perche' dipende dalla larghezza corrente della finestra.
function maxFor() {
  return Math.min(SIDEBAR.max, window.innerWidth - DIVIDER - EDITOR_MIN)
}

function clamp(value) {
  return Math.max(SIDEBAR.min, Math.min(maxFor(), value))
}

let drag = null

function startDrag(event) {
  event.preventDefault() // impedisce la selezione del testo durante il trascinamento
  drag = { startX: event.clientX, startWidth: sidebarWidth.value }
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', endDrag)
  document.body.classList.add('is-resizing')
}

function onDrag(event) {
  if (!drag) return
  sidebarWidth.value = clamp(drag.startWidth + (event.clientX - drag.startX))
}

function endDrag() {
  drag = null
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', endDrag)
  document.body.classList.remove('is-resizing')
}

// Doppio click sul divisorio: torna alla larghezza di partenza, come fanno
// molti editor. Evita di restare incastrati in una larghezza scomoda.
function resetPane() {
  sidebarWidth.value = clamp(SIDEBAR.default)
}

// Rimpicciolendo la finestra i due pannelli fissi resterebbero larghi come
// prima, mangiando lo spazio dell'editor fino a farlo sparire: qui si
// ri-applicano i limiti, che dipendono da window.innerWidth.
function onWindowResize() {
  const narrow = window.innerWidth < DRAWER_BELOW
  // Entrando in modalita' sovrapposta il pannello va chiuso: restando aperto
  // coprirebbe il contenuto proprio quando lo spazio scarseggia. Uscendone si
  // riapre, tornando allo stato atteso a finestra larga.
  if (narrow !== isNarrow.value) {
    ui.setNarrow(narrow)
    if (narrow === ui.sidebarVisible) ui.toggleSidebar()
  }
  if (sidebarInLayout.value) sidebarWidth.value = clamp(sidebarWidth.value)
}

// Scegliendo una cartella si torna alla vista note: e' il senso del
// master-detail. Un watch e non una chiamata in Sidebar perche' selectFolder
// viene invocata da piu' punti (click sulla voce, menu contestuale, creazione
// di una cartella nuova), e uno dimenticato lascerebbe il pannello sulle
// cartelle.
watch(
  () => store.selectedFolderId,
  () => ui.showNotes()
)

// Aprendo una nota il pannello sovrapposto si chiude: e' il momento in cui si
// vuole l'editor libero.
watch(
  () => store.selectedNoteId,
  () => {
    if (isNarrow.value && ui.sidebarVisible) ui.toggleSidebar()
  }
)

function onKeydown(event) {
  // Zoom in dalla tastiera principale. L'acceleratore del menu nativo copre
  // un solo carattere per piattaforma ("+" su macOS, "=" altrove) e consuma
  // il tasto prima che arrivi qui; il carattere non coperto lo prende questo
  // handler, cosi' ⌘+ e ⌘= funzionano su ogni layout (menu.rs). Meno e zero
  // sono gia' del menu su tutti i layout: qui non si toccano, altrimenti
  // scatterebbero due volte.
  if ((event.metaKey || event.ctrlKey) && !event.altKey && (event.key === '+' || event.key === '=')) {
    event.preventDefault()
    api.zoomIn()
    return
  }
  // Con le impostazioni aperte Esc spetta a loro: le chiude SettingsPage.
  if (ui.settingsOpen) return
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
      const folder = store.createFolder()
      store.selectFolder(folder.id)
    }),
    api.onMenu('menu:duplicate-note', () => {
      if (store.selectedNoteId) store.duplicateNote(store.selectedNoteId)
    }),
    // La ricerca vive nella banda della vista note, che e' montata solo a
    // pannello visibile e su quella vista: entrambe le condizioni vanno
    // soddisfatte prima, altrimenti il componente non esiste e non c'e'
    // nulla da mettere a fuoco.
    api.onMenu('menu:search-all', async () => {
      if (!ui.sidebarVisible) ui.toggleSidebar()
      ui.showNotes()
      await nextTick()
      noteListRef.value?.openSearch()
    }),
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
/* Riga e non colonna: cartelle e lista arrivano da cima a fondo finestra, e
   l'header vive nella colonna di destra sopra il solo editor.
   position: relative e' l'origine del cassetto sovrapposto, del suo velo e
   della striscia di trascinamento. */
.app-root {
  position: relative;
  height: 100vh;
  display: flex;
  overflow: hidden;
}

/* Colonna di destra: header sopra, editor sotto. */
.main-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Striscia sopra cartelle+lista: solo lo spazio dei semafori, niente
   sfondo. z-index sopra i pannelli, sotto il cassetto (20). */
.browse-drag {
  position: absolute;
  top: 0;
  left: 0;
  height: 40px;
  z-index: 10;
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


/* Sovrapposto (finestra stretta): fuori dal flusso, quindi l'editor si
   prende tutta la larghezza come se il pannello non esistesse. Da cima a
   fondo finestra. z-index sopra il divisorio (5) e il velo (15). */
.sidebar-panel.is-drawer {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  /* min() e non una larghezza fissa: alla finestra minima un pannello da
     320px lascerebbe pochissimo editor dietro al velo. */
  width: min(320px, 82%);
  z-index: 20;
  box-shadow: 2px 0 16px rgba(0, 0, 0, 0.28);
  border-right: 1px solid var(--p-content-border-color);
}

/* Fondo netto nel cassetto: --sidebar-bg e' semitrasparente (nel flusso ha
   sotto solo lo sfondo finestra), ma qui il pannello copre l'editor e si
   leggeva il testo attraverso. Va sovrascritto anche sui figli, che
   dipingono a loro volta con la variabile traslucida. */
.sidebar-panel.is-drawer,
.sidebar-panel.is-drawer .sidebar,
.sidebar-panel.is-drawer .note-list {
  background: var(--sidebar-bg-solid);
}

/* SOLO la zona dei semafori, non tutta la banda: la banda ora contiene i
   pulsanti (indietro, cerca, nuova nota) e questa striscia sta sopra di
   loro, quindi allargandola ne intercetta i click e li rende inerti — non
   c'entrano i drag region, e' l'elemento sovrapposto a ricevere il click.
   Larghezza fissa: i tre tasti finestra occupano ~68px da x:14. */
.browse-drag {
  position: absolute;
  top: 0;
  left: 0;
  width: 74px;
  height: 40px;
  z-index: 10;
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
