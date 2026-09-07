<template>
  <!-- Barra unica in cima alla finestra. Con titleBarStyle Overlay +
       hiddenTitle la barra del titolo nativa non esiste più: è questa la
       superficie con cui si sposta la finestra, quindi porta
       data-tauri-drag-region. -->
  <header class="app-header" data-tauri-drag-region="deep">
    <!-- I semafori della finestra sono disegnati sopra questa barra (vedi
         trafficLightPosition in tauri.conf.json): il padding-left li
         scavalca invece di finirci sotto. -->
    <div class="header-left">
      <button
        class="icon-btn"
        :class="{ active: sidebarVisible }"
        :title="sidebarVisible ? 'Nascondi cartelle' : 'Mostra cartelle'"
        @click="emit('toggle-sidebar')"
      >
        <Icon icon="lucide:panel-left" />
      </button>
      <!-- Breadcrumb al posto del nome dell'app: cartella corrente e nota
           aperta. drag-region="false" perche' la cartella e' cliccabile e un
           click accanto al testo non deve trascinare la finestra. -->
      <nav ref="crumbWrapEl" class="crumbs" data-tauri-drag-region="false">
        <button
          class="crumb crumb-folder"
          :class="{ active: notesMenuOpen }"
          :title="`Note in ${store.currentViewName}`"
          @click="toggleNotesMenu"
        >
          <Icon :icon="folderIcon" />
          <span class="crumb-label">{{ store.currentViewName }}</span>
          <Icon icon="lucide:chevron-down" class="crumb-chevron" />
        </button>

        <template v-if="store.selectedNote">
          <Icon icon="lucide:chevron-right" class="crumb-sep" />
          <span class="crumb crumb-note" :title="noteTitle">{{ noteTitle }}</span>
        </template>

        <!-- Le note della vista corrente, per aprirle senza passare dalla
             lista: utile soprattutto a cartelle e lista nascoste. -->
        <div v-if="notesMenuOpen" class="crumb-panel">
          <div class="panel-label">Note in {{ store.currentViewName }}</div>
          <p v-if="!store.visibleNotes.length" class="panel-empty">Nessuna nota</p>
          <!-- Stessa struttura e stesso stile della voce nella lista note
               (.note-item in NoteList): titolo in grassetto, sotto ora e
               anteprima. -->
          <button
            v-for="note in store.visibleNotes.slice(0, MAX_CRUMB_NOTES)"
            :key="note.id"
            class="crumb-note-item"
            :class="{ active: note.id === store.selectedNoteId }"
            @click="openFromCrumb(note.id)"
          >
            <span class="crumb-note-top">
              <Icon v-if="note.pinned" icon="lucide:star" class="pin-icon" />
              <span class="crumb-note-title">{{ note.title || 'Nuova nota' }}</span>
            </span>
            <span class="crumb-note-meta">
              <span class="crumb-note-date">{{ formatNoteDate(note.updatedAt) }}</span>
              <span class="crumb-note-preview">{{ notePreview(note.content) }}</span>
            </span>
          </button>
        </div>
      </nav>
    </div>

    <!-- A finestra stretta il "+" e' l'unico modo di creare: il tasto "Nuova
         nota" vive nell'intestazione della lista, che a quella larghezza sta
         chiusa nel cassetto. -->
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

    <!-- drag-region="false": qui dentro si clicca per cercare, non per
         spostare la finestra. Senza, un click sul bordo della barra (fuori
         dall'<input>, che Tauri esclude da se') la trascinerebbe.
         A finestra stretta la barra centrale lascia il posto a una sola
         icona a destra: a quella larghezza il breadcrumb e la barra si
         toglierebbero lo spazio a vicenda. -->
    <div
      ref="searchWrapEl"
      :class="narrow ? 'header-search-compact' : 'header-center'"
      data-tauri-drag-region="false"
    >
      <button
        v-if="narrow"
        class="icon-btn"
        :class="{ active: panelOpen }"
        :title="`Cerca in tutte le note (${searchHint})`"
        @click="toggleSearchPanel"
      >
        <Icon icon="lucide:search" />
      </button>

      <div v-else class="search-bar" :class="{ focused: panelOpen }" @click="focusInput">
        <Icon icon="lucide:search" class="search-icon" />
        <input
          ref="searchInputEl"
          v-model="query"
          type="text"
          placeholder="Cerca in tutte le note"
          @focus="panelOpen = true"
          @keydown.esc="close"
          @keydown.down.prevent="move(1)"
          @keydown.up.prevent="move(-1)"
          @keydown.enter.prevent="openHighlighted"
        />
        <button v-if="query" class="clear-btn" title="Cancella" @click.stop="clearQuery">
          <Icon icon="lucide:x" />
        </button>
        <kbd v-else class="hint-kbd">{{ searchHint }}</kbd>
      </div>

      <div v-if="panelOpen" class="search-panel" :class="{ 'panel-right': narrow }">
        <!-- Senza la barra, il campo deve stare nel pannello: e' l'unico
             posto in cui digitare. -->
        <div v-if="narrow" class="panel-field">
          <Icon icon="lucide:search" class="search-icon" />
          <input
            ref="searchInputCompactEl"
            v-model="query"
            type="text"
            placeholder="Cerca in tutte le note"
            @keydown.esc="close"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="openHighlighted"
          />
          <button v-if="query" class="clear-btn" title="Cancella" @click="clearQuery">
            <Icon icon="lucide:x" />
          </button>
        </div>

        <div class="panel-label">{{ query.trim() ? 'Risultati' : 'Note recenti' }}</div>

        <p v-if="!items.length" class="panel-empty">
          {{ query.trim() ? `Nessun risultato per "${query}"` : 'Nessuna nota' }}
        </p>

        <button
          v-for="(item, i) in items"
          :key="item.note.id"
          class="result"
          :class="{ highlighted: i === highlighted }"
          @click="open(item.note.id)"
          @mouseenter="highlighted = i"
        >
          <span class="result-title">{{ item.note.title || 'Nuova nota' }}</span>
          <span class="result-meta">
            <Icon :icon="item.note.trashed ? 'lucide:trash-2' : 'lucide:folder'" />
            {{ item.folderName }}
            <span class="result-date">{{ formatNoteDate(item.note.updatedAt) }}</span>
          </span>
          <span v-if="item.snippet" class="result-snippet">{{ item.snippet }}</span>
        </button>
      </div>
    </div>

    <!-- Contrappeso della sezione sinistra: con lo stesso flex su entrambi i
         lati la barra resta centrata nella finestra e non nello spazio
         residuo. Solo a finestra larga: in modalità stretta non c'è una barra
         da centrare, e questo flex:1 si spartirebbe lo spazio libero con la
         sezione sinistra tenendo le icone lontane dal bordo destro. -->
    <div v-if="!narrow" class="header-right"></div>
  </header>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useNotesStore } from '../stores/notes'
import { stripHtml } from '../utils/markdown'
import { formatNoteDate, notePreview } from '../utils/noteDisplay'
import { isMac } from '../utils/shortcuts'

defineProps({
  sidebarVisible: { type: Boolean, default: true },
  // Deciso in App.vue insieme al cassetto: un'unica soglia per tutta l'app
  // invece di un secondo osservatore qui, che potrebbe scattare a una
  // larghezza diversa.
  narrow: { type: Boolean, default: false }
})
const emit = defineEmits(['toggle-sidebar'])

const store = useNotesStore()

const panelOpen = ref(false)
const query = ref('')
const highlighted = ref(0)
const searchInputEl = ref(null)
// Il campo di ricerca esiste in due varianti mutuamente esclusive: nella
// barra (finestra larga) o dentro il pannello (stretta). Solo una e' resa,
// quindi si mette a fuoco quella che c'e'.
const searchInputCompactEl = ref(null)
const activeSearchInput = () => searchInputEl.value || searchInputCompactEl.value
const searchWrapEl = ref(null)

const createMenuOpen = ref(false)
const createWrapEl = ref(null)

const noteTitle = computed(() => store.selectedNote?.title?.trim() || 'Nuova nota')

// Icona coerente con la voce scelta nella sidebar, così il breadcrumb non
// mostra una cartellina anche per Preferiti o Cestino.
const folderIcon = computed(() => {
  if (store.isTrashView) return 'lucide:trash-2'
  if (store.isPinnedView) return 'lucide:star'
  if (store.isAllView) return 'lucide:notebook-text'
  return 'lucide:folder'
})

const MAX_CRUMB_NOTES = 50
const notesMenuOpen = ref(false)
const crumbWrapEl = ref(null)

function toggleSearchPanel() {
  panelOpen.value ? close() : openSearch()
}

function toggleCreateMenu() {
  createMenuOpen.value = !createMenuOpen.value
  if (createMenuOpen.value) {
    // un pannello alla volta
    panelOpen.value = false
    notesMenuOpen.value = false
  }
}

function createNote() {
  store.createNote()
  createMenuOpen.value = false
}

// Stessa coppia di azioni della voce di menu nativa "Nuova Cartella": creare
// e selezionare, così la cartella nuova è subito quella attiva.
function createFolder() {
  const folder = store.createFolder('Nuova cartella')
  store.selectFolder(folder.id)
  createMenuOpen.value = false
}

function toggleNotesMenu() {
  notesMenuOpen.value = !notesMenuOpen.value
  if (notesMenuOpen.value) {
    panelOpen.value = false // un pannello alla volta
    createMenuOpen.value = false
  }
}

function openFromCrumb(noteId) {
  store.selectNote(noteId)
  notesMenuOpen.value = false
}
const searchHint = computed(() => (isMac ? '⇧⌘F' : 'Ctrl+Shift+F'))

const MAX_RESULTS = 40
const MAX_RECENTS = 8

// Note recenti, mostrate quando la query è vuota: dà al pannello un
// contenuto utile appena si apre, invece di un riquadro vuoto.
const recents = computed(() =>
  store.notes
    .filter((n) => !n.trashed)
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_RECENTS)
    .map((note) => ({ note, folderName: folderNameFor(note), snippet: '' }))
)

// Ricerca su tutte le note, indipendente da selectedFolderId: è la
// differenza rispetto a visibleNotes, che filtra prima per cartella.
// Il limite evita di costruire centinaia di nodi per una query di una
// lettera; stripHtml è la stessa funzione usata dall'anteprima nella lista,
// così si cerca nel testo che si legge e non nei tag HTML.
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  const out = []
  for (const note of store.notes) {
    const body = stripHtml(note.content || '')
    const hay = `${note.title || ''} ${body}`.toLowerCase()
    if (!hay.includes(q)) continue
    out.push({ note, folderName: folderNameFor(note), snippet: snippetAround(body, q) })
    if (out.length >= MAX_RESULTS) break
  }
  return out
})

// Una sola lista per la navigazione da tastiera, qualunque cosa sia
// visualizzata: evita di duplicare la logica di frecce e Invio.
const items = computed(() => (query.value.trim() ? results.value : recents.value))

function folderNameFor(note) {
  if (note.trashed) return 'Cestino'
  const folder = store.folders.find((f) => f.id === note.folderId)
  return folder ? folder.name : 'Senza cartella'
}

// Estratto centrato sulla prima occorrenza, così si vede *perché* la nota è
// un risultato invece dell'inizio del testo (che spesso non la contiene).
// Se la corrispondenza è solo nel titolo l'indice è -1 e si parte da capo.
function snippetAround(body, q) {
  if (!body) return ''
  const at = body.toLowerCase().indexOf(q)
  const start = at === -1 ? 0 : Math.max(0, at - 32)
  const text = body.slice(start, start + 110).replace(/\s+/g, ' ').trim()
  return (start > 0 ? '…' : '') + text + (start + 110 < body.length ? '…' : '')
}

// Esposta ad App.vue per la voce di menu ⇧⌘F.
async function openSearch() {
  panelOpen.value = true
  notesMenuOpen.value = false // un pannello alla volta, come in toggleNotesMenu
  createMenuOpen.value = false
  await nextTick()
  const el = activeSearchInput()
  el?.focus()
  el?.select()
}

function close() {
  panelOpen.value = false
  activeSearchInput()?.blur()
}

function clearQuery() {
  query.value = ''
  activeSearchInput()?.focus()
}

function focusInput() {
  activeSearchInput()?.focus()
}

function move(delta) {
  if (!items.value.length) return
  const n = items.value.length
  // wrap-around: dall'ultimo si torna al primo, come nei menu nativi
  highlighted.value = (highlighted.value + delta + n) % n
}

function openHighlighted() {
  const item = items.value[highlighted.value]
  if (item) open(item.note.id)
}

function open(noteId) {
  store.revealNote(noteId)
  query.value = ''
  close()
}

// Una nuova query invalida la posizione precedente nella lista.
watch(query, () => {
  highlighted.value = 0
})

function onGlobalMousedown(event) {
  if (panelOpen.value && searchWrapEl.value && !searchWrapEl.value.contains(event.target)) {
    close()
  }
  if (notesMenuOpen.value && crumbWrapEl.value && !crumbWrapEl.value.contains(event.target)) {
    notesMenuOpen.value = false
  }
  if (createMenuOpen.value && createWrapEl.value && !createWrapEl.value.contains(event.target)) {
    createMenuOpen.value = false
  }
}

onMounted(() => window.addEventListener('mousedown', onGlobalMousedown))
onBeforeUnmount(() => window.removeEventListener('mousedown', onGlobalMousedown))

defineExpose({ openSearch })
</script>

<style scoped>
.app-header {
  flex-shrink: 0;
  height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  /* 74px a sinistra: i tre semafori partono da x:14 e occupano ~54px, il
     contenuto deve iniziare dopo di loro. */
  padding: 0 12px 0 74px;
  background: var(--sidebar-bg);
  border-bottom: 1px solid var(--p-content-border-color);
}

/* La sezione sinistra assorbe lo spazio; min-width: 0 permette al titolo di
   troncarsi invece di allargarla spingendo fuori la ricerca. */
.header-left,
.header-right {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Larghezza propria e non flessibile: e' cio' che, insieme al flex uguale
   sui due lati, tiene la barra centrata rispetto alla finestra. max-width in
   percentuale perche' a finestra stretta non deve schiacciare il titolo.
   position:relative e' l'ancora del pannello (position:absolute): non serve
   un Teleport come per il color picker dell'editor, dove il bottone viveva
   fuori dal template del componente. */
.header-center {
  position: relative;
  flex: 0 0 auto;
  width: 380px;
  max-width: 44%;
}

/* Modalità stretta: solo icone a destra, senza larghezza propria. */
.header-search-compact,
.header-create {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

/* Il pannello, che a finestra larga è ancorato alla barra, qui va allineato
   a destra sotto l'icona e con una larghezza propria. */
.search-panel.panel-right {
  left: auto;
  right: 0;
  width: 340px;
}

/* Campo di ricerca in testa al pannello, quando la barra non c'è. */
.panel-field {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 10px;
  margin: -4px -4px 2px;
  background: var(--editor-toolbar-bg);
  border-bottom: 1px solid var(--p-content-border-color);
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

.search-bar {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 9px;
  background: var(--search-bg);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: text;
}
.search-bar.focused {
  border-color: var(--p-content-border-color);
  background: var(--editor-toolbar-bg);
}
.search-bar input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--p-text-color);
  font-size: 13px;
  outline: none;
}

/* Scorciatoia mostrata dentro la barra finche' e' vuota: appena si digita
   lascia il posto al bottone per cancellare. */
.hint-kbd {
  flex-shrink: 0;
  font-family: inherit;
  font-size: 10.5px;
  color: var(--p-text-muted-color);
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  padding: 1px 4px;
}

/* Breadcrumb: cartella corrente › nota aperta. position:relative e' l'ancora
   del pannello delle note. min-width:0 permette al titolo della nota di
   troncarsi invece di allargare la sezione e spingere fuori la ricerca. */
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

.crumb-folder {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--p-text-color);
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 6px;
  outline: none;
}
.crumb-folder:hover,
.crumb-folder.active {
  background: var(--sidebar-hover-bg);
}
.crumb-folder :deep(svg) {
  font-size: 14px;
  color: var(--icon-color);
  flex-shrink: 0;
}
.crumb-label {
  white-space: nowrap;
}
/* Chevron piu' piccolo e smorzato: e' un affordance, non un contenuto. */
.crumb-folder .crumb-chevron {
  font-size: 12px;
  opacity: 0.6;
}

.crumb-sep {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--p-text-muted-color);
  opacity: 0.7;
}

/* La nota e' l'ultimo segmento: non cliccabile (e' gia' quella aperta) e
   l'unico che si tronca, essendo l'unico di lunghezza imprevedibile. */
.crumb-note {
  color: var(--p-text-muted-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Voce nota nel menu del breadcrumb: stessi valori di .note-item nella lista
   (NoteList), così le due liste di note si somigliano invece di essere due
   stili diversi per la stessa cosa. */
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

/* Stesso aspetto del pannello di ricerca, ancorato a sinistra sotto la
   cartella invece che a destra. */
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
   di cui riusa l'aspetto: stessa specificità, quindi vince l'ultima regola —
   dichiarandolo prima, il width: 360px sovrascriveva questo.
   Ancorato a destra perché il "+" sta sul bordo destro dell'header: con
   left: 0 il pannello sborderebbe dalla finestra. */
.create-panel {
  left: auto;
  right: 0;
  width: max-content;
  min-width: 170px;
}

/* Campo di ricerca in testa al pannello: sticky perché il pannello scorre
   e il campo deve restare visibile mentre si guardano i risultati. */
.search-icon {
  font-size: 14px;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}
.clear-btn {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--icon-color);
  cursor: pointer;
  display: flex;
  padding: 2px;
  border-radius: 4px;
}
.clear-btn:hover {
  color: var(--p-text-color);
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
/* .active: il tasto del blocco cartelle+note non cambia glifo (vedi il
   commento nel template), quindi lo stato lo comunica lo sfondo. */
.icon-btn:hover,
.icon-btn.active {
  background: var(--sidebar-hover-bg);
  color: var(--p-text-color);
}

.search-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 62vh;
  overflow-y: auto;
  padding: 4px;
  background: var(--editor-toolbar-bg);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  z-index: 100;
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

.result {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  text-align: left;
}
/* Un solo stato visivo per mouse e tastiera: highlighted segue anche
   mouseenter, così non si vedono due righe "attive" insieme. */
.result.highlighted {
  background: var(--sidebar-hover-bg);
}

.result-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--p-text-muted-color);
}
.result-date {
  margin-left: auto;
  flex-shrink: 0;
}

.result-snippet {
  font-size: 12px;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
