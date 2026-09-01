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
        :title="sidebarVisible ? 'Nascondi barra laterale' : 'Mostra barra laterale'"
        @click="emit('toggle-sidebar')"
      >
        <Icon :icon="sidebarVisible ? 'lucide:panel-left-close' : 'lucide:panel-left-open'" />
      </button>
      <span class="app-name">Mac Notes</span>
      <span v-if="store.selectedNote" class="note-title" :title="noteTitle">{{ noteTitle }}</span>
    </div>

    <!-- drag-region="false": qui dentro si clicca per cercare, non per
         spostare la finestra. -->
    <div ref="searchWrapEl" class="header-right" data-tauri-drag-region="false">
      <button
        class="icon-btn"
        :class="{ active: panelOpen }"
        :title="`Cerca in tutte le note (${searchHint})`"
        @click="togglePanel"
      >
        <Icon icon="lucide:search" />
      </button>

      <div v-if="panelOpen" class="search-panel">
        <div class="panel-field">
          <Icon icon="lucide:search" class="search-icon" />
          <input
            ref="searchInputEl"
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
            <span class="result-date">{{ formatDate(item.note.updatedAt) }}</span>
          </span>
          <span v-if="item.snippet" class="result-snippet">{{ item.snippet }}</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useNotesStore } from '../stores/notes'
import { stripHtml } from '../utils/markdown'
import { isMac } from '../utils/shortcuts'

defineProps({
  sidebarVisible: { type: Boolean, default: true }
})
const emit = defineEmits(['toggle-sidebar'])

const store = useNotesStore()

const panelOpen = ref(false)
const query = ref('')
const highlighted = ref(0)
const searchInputEl = ref(null)
const searchWrapEl = ref(null)

const noteTitle = computed(() => store.selectedNote?.title?.trim() || 'Nuova nota')
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

function formatDate(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const today = new Date()
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  return sameDay
    ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

// Esposta ad App.vue per la voce di menu ⇧⌘F.
async function openSearch() {
  panelOpen.value = true
  await nextTick()
  searchInputEl.value?.focus()
  searchInputEl.value?.select()
}

function close() {
  panelOpen.value = false
  searchInputEl.value?.blur()
}

function clearQuery() {
  query.value = ''
  searchInputEl.value?.focus()
}

function togglePanel() {
  panelOpen.value ? close() : openSearch()
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
}

onMounted(() => window.addEventListener('mousedown', onGlobalMousedown))
onBeforeUnmount(() => window.removeEventListener('mousedown', onGlobalMousedown))

defineExpose({ openSearch })
</script>

<style scoped>
.app-header {
  flex-shrink: 0;
  height: 42px;
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
.header-left {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* position:relative: è l'ancora del pannello di ricerca (position:absolute).
   Non serve un Teleport come per il color picker dell'editor, dove il
   bottone viveva fuori dal template del componente. */
.header-right {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.app-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
  flex-shrink: 0;
}

/* Titolo della nota accanto al nome dell'app, allineato a sinistra. Il
   separatore è un bordo e non un carattere, così non compare quando manca
   il titolo. */
.note-title {
  font-size: 13px;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 8px;
  border-left: 1px solid var(--p-content-border-color);
}

/* Campo di ricerca in testa al pannello: sticky perché il pannello scorre
   e il campo deve restare visibile mentre si guardano i risultati. */
.panel-field {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 10px;
  margin: -4px -4px 2px;
  background: var(--editor-toolbar-bg);
  border-bottom: 1px solid var(--p-content-border-color);
}
.search-icon {
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
.icon-btn:hover,
.icon-btn.active {
  background: var(--sidebar-hover-bg);
  color: var(--p-text-color);
}

.search-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 420px;
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
