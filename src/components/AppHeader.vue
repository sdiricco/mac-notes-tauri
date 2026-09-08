<template>
  <!-- Barra in cima alla colonna di destra (non a tutta larghezza: cartelle e
       lista arrivano fino in cima, vedi App.vue). Con titleBarStyle Overlay +
       hiddenTitle la barra del titolo nativa non esiste, quindi questa e' una
       delle superfici con cui si sposta la finestra: data-tauri-drag-region.
       -webkit-app-region non funziona in WKWebView, e' una feature del
       Chromium modificato di Electron. -->
  <header class="app-header" data-tauri-drag-region="deep">
    <div class="header-left" :class="{ 'clears-traffic-lights': !browseInLayout }">
      <button
        class="icon-btn toggle-btn"
        :class="{ active: sidebarVisible }"
        :title="sidebarVisible ? 'Nascondi cartelle' : 'Mostra cartelle'"
        @click="emit('toggle-sidebar')"
      >
        <Icon icon="lucide:panel-left" />
      </button>

      <!-- Breadcrumb: cartella corrente > nota aperta. drag-region="false"
           perche' la cartella e' cliccabile e un click accanto al testo non
           deve trascinare la finestra. -->
      <!-- Breadcrumb PASSIVO: mostra dove ci si trova, non e' un comando.
           La cartella si scegle dal pannello laterale (vista cartelle) e la
           nota dalla sua lista: avere anche qui due menu che facevano le
           stesse cose era una seconda strada da mantenere. -->
      <nav class="crumbs" aria-label="Posizione">
        <span class="crumb crumb-folder">
          <span class="crumb-label">{{ store.currentViewName }}</span>
        </span>
        <template v-if="store.selectedNote">
          <Icon icon="lucide:chevron-right" class="crumb-sep" />
          <span class="crumb crumb-note" :title="noteTitle">{{ noteTitle }}</span>
        </template>
      </nav>
    </div>

    <!-- A finestra stretta il "+" e' l'unico modo di creare: il tasto "Nuova
         nota" vive nell'intestazione della lista, che a quella larghezza sta
         chiusa nel cassetto. A finestra larga non lo mostro, per non
         duplicare un comando gia' raggiungibile. -->
    <div v-if="narrow" ref="createWrapEl" class="header-create" data-tauri-drag-region="false">
      <button
        class="icon-btn"
        :class="{ active: createMenuOpen }"
        title="Crea"
        @click="toggleCreateMenu"
      >
        <Icon icon="lucide:plus" />
      </button>
      <div v-if="createMenuOpen" class="crumb-panel create-panel">
        <button class="menu-row" @click="createNote">
          <Icon icon="lucide:square-pen" />
          <span>Nuova nota</span>
        </button>
        <button class="menu-row" @click="createFolder">
          <Icon icon="lucide:folder-plus" />
          <span>Nuova cartella</span>
        </button>
      </div>
    </div>

    <!-- Bersaglio del Teleport delle azioni sulla nota (cerca nella nota,
         preferito, cestino, "⋮"): il markup e la logica restano in
         NoteEditor — dialogo Markdown, riferimento all'editor, ortografia —
         e qui ne cambia solo la posizione nel DOM. Cablare quelle azioni
         attraverso due componenti avrebbe richiesto una catena di ref ed
         eventi per la stessa resa. -->
    <div id="header-note-actions" class="header-note-actions" data-tauri-drag-region="false"></div>

    <div class="header-settings" data-tauri-drag-region="false">
      <button class="icon-btn" title="Impostazioni (⌘,)" @click="ui.openSettings()">
        <Icon icon="lucide:settings" />
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useNotesStore } from '../stores/notes'
import { useUiStore } from '../stores/ui'
import { formatNoteDate, notePreview } from '../utils/noteDisplay'

defineProps({
  sidebarVisible: { type: Boolean, default: true },
  // Deciso in App.vue insieme al cassetto: un'unica soglia per tutta l'app
  // invece di un secondo osservatore qui, che potrebbe scattare a una
  // larghezza diversa e mostrare stati incoerenti.
  narrow: { type: Boolean, default: false },
  // Cartelle e lista sono nel flusso a sinistra? In quel caso i semafori
  // della finestra cadono su di loro e l'header non deve scavalcarli.
  browseInLayout: { type: Boolean, default: false }
})
const emit = defineEmits(['toggle-sidebar'])

const store = useNotesStore()
const ui = useUiStore()

const noteTitle = computed(() => store.selectedNote?.title?.trim() || 'Nuova nota')

function toggleCreateMenu() {
  createMenuOpen.value = !createMenuOpen.value
}

function createNote() {
  store.createNote()
  createMenuOpen.value = false
}

// Stessa coppia di azioni della voce di menu nativa "Nuova Cartella": creare
// e selezionare, cosi' la cartella nuova e' subito quella attiva.
function createFolder() {
  const folder = store.createFolder('Nuova cartella')
  store.selectFolder(folder.id)
  createMenuOpen.value = false
}

function onGlobalMousedown(event) {
  if (createMenuOpen.value && createWrapEl.value && !createWrapEl.value.contains(event.target)) {
    createMenuOpen.value = false
  }
}

onMounted(() => window.addEventListener('mousedown', onGlobalMousedown))
onBeforeUnmount(() => window.removeEventListener('mousedown', onGlobalMousedown))
</script>

<style scoped>
.app-header {
  flex-shrink: 0;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  background: var(--sidebar-bg);
  border-bottom: 1px solid var(--p-content-border-color);
}

/* 62px: i tre semafori partono da x:14 e occupano ~54px. Serve solo quando
   l'header e' al bordo sinistro della finestra: con cartelle e lista nel
   flusso i semafori cadono su quelle (vedi .browse-drag in App.vue). */
.header-left.clears-traffic-lights {
  padding-left: 62px;
}

/* min-width: 0 permette al titolo della nota di troncarsi invece di
   allargare la sezione. */
.header-left {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Gruppo azioni e impostazioni in fondo a destra. */
.header-note-actions,
.header-settings {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.header-create {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

/* Stacca il tasto dal bordo (o dai semafori, quando l'header e' a
   sinistra). */
.toggle-btn {
  margin-left: 6px;
}

.icon-btn {
  border: none;
  background: transparent;
  color: var(--icon-color);
  cursor: pointer;
  padding: 5px;
  border-radius: 6px;
  font-size: 15px;
  display: flex;
  align-items: center;
  outline: none;
  flex-shrink: 0;
}
/* .active: il tasto delle cartelle non cambia glifo, lo stato lo comunica lo
   sfondo. */
.icon-btn:hover,
.icon-btn.active {
  background: var(--sidebar-hover-bg);
  color: var(--p-text-color);
}

/* position: relative e' l'ancora del pannello delle note. */
.crumbs {
  position: relative;
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
}

.crumb {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  min-width: 0;
}

/* Il breadcrumb e' passivo: nessuno stile da bottone (hover, cursore,
   sfondo, bordo arrotondato). Erano avanzi di quando i due segmenti erano
   cliccabili e aprivano dei menu. */
.crumb-folder {
  flex-shrink: 0;
  color: var(--p-text-color);
  font-weight: 600;
}
.crumb-folder :deep(svg) {
  font-size: 14px;
  color: var(--icon-color);
  flex-shrink: 0;
}
.crumb-label {
  white-space: nowrap;
}

.crumb-sep {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--p-text-muted-color);
  opacity: 0.7;
}

/* La nota e' l'ultimo segmento e l'unico che si tronca, essendo l'unico di
   lunghezza imprevedibile. */
.crumb-note {
  min-width: 0;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Pannello cartelle: largo quanto serve alle voci, non 360px come quello
   delle note. Va dopo .crumb-panel: stessa specificita', vince l'ultima. */
.folders-panel {
  width: max-content;
  min-width: 220px;
}

/* Campo di rinomina in testa al pannello delle note. */
.panel-field {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 10px;
  margin: -4px -4px 2px;
  background: var(--editor-toolbar-bg);
  border-bottom: 1px solid var(--p-content-border-color);
}
.field-icon {
  font-size: 14px;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}
.panel-field input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--p-text-color);
  font-size: 13px;
  outline: none;
}

.menu-row.active {
  background: var(--selection-bg);
}
.menu-row .grow {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-count {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--p-text-muted-color);
}

.crumb-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 360px;
  max-height: 62vh;
  overflow-y: auto;
  padding: 4px;
  background: var(--editor-toolbar-bg);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  z-index: 100;
}

/* Menu del "+": largo quanto le sue voci, non 360px. Va DOPO .crumb-panel,
   di cui riusa l'aspetto: stessa specificita', quindi vince l'ultima regola.
   Ancorato a destra perche' il "+" sta sul bordo destro dell'header. */
.create-panel {
  left: auto;
  right: 0;
  width: max-content;
  min-width: 170px;
}

.panel-label {
  padding: 6px 10px 4px;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--p-text-muted-color);
}
.panel-empty {
  margin: 0;
  padding: 8px 10px 12px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}

/* Voce nota: stessi valori di .note-item nella lista, cosi' le due liste di
   note si somigliano invece di essere due stili per la stessa cosa. */
.crumb-note-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  margin-bottom: 2px;
}
.crumb-note-item:hover {
  background: var(--sidebar-hover-bg);
}
.crumb-note-item.active {
  background: var(--card-bg);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.14);
}

.crumb-note-top {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.crumb-note-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--p-text-color);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.crumb-note-top .pin-icon {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--icon-color);
}

.crumb-note-meta {
  display: flex;
  gap: 6px;
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin-top: 2px;
  min-width: 0;
}
.crumb-note-date {
  flex-shrink: 0;
}
.crumb-note-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Voce dei menu a comparsa dell'header (creazione): stesse metriche delle
   righe dei menu PrimeVue usate altrove nell'app. */
.menu-row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--p-text-color);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}
.menu-row:hover {
  background: var(--sidebar-hover-bg);
}
.menu-row :deep(svg) {
  font-size: 15px;
  color: var(--icon-color);
  flex-shrink: 0;
}
</style>
