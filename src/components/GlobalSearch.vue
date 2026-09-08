<template>
  <!-- Ricerca su tutte le cartelle. Estratta da AppHeader in un componente
       proprio quando è stata spostata accanto al titolo della lista: la
       logica (risultati, recenti, navigazione da tastiera) è una sola, e
       duplicarla l'avrebbe fatta divergere. -->
  <div ref="wrapEl" class="global-search">
    <button
      class="icon-btn"
      :class="{ active: panelOpen }"
      :title="`Cerca in tutte le note (${searchHint})`"
      @click="toggle"
    >
      <Icon icon="lucide:search" />
    </button>

    <!-- Teleport su <body>: il pannello della lista ha overflow: hidden e
         ritagliava il riquadro, che gli era interno. Non era un problema di
         z-index — nessun valore lo avrebbe fatto uscire da un contenitore
         che ritaglia. Stessa soluzione del tooltip della toolbar e del
         picker colore.
         Il riquadro non e' piu' ancorato all'icona: e' un dialogo centrato,
         e a finestra stretta occupa tutto. Cosi' non serve piu' calcolarne
         le coordinate, e il velo dice che finche' e' aperto si cerca. -->
    <Teleport to="body">
      <div v-if="panelOpen" class="search-overlay" :class="{ 'is-fullscreen': ui.narrow }">
        <div ref="panelEl" class="search-panel">
          <div class="panel-field">
            <Icon icon="lucide:search" class="field-icon" />
            <input
              ref="inputEl"
              v-model="query"
              type="text"
              placeholder="Cerca in tutte le note"
              @keydown.esc.stop="close"
              @keydown.down.prevent="move(1)"
              @keydown.up.prevent="move(-1)"
              @keydown.enter.prevent="openHighlighted"
            />
            <button v-if="query" class="clear-btn" title="Cancella" @click="clearQuery">
              <Icon icon="lucide:x" />
            </button>
            <!-- A tutta pagina non c'e' velo da cliccare per uscire: serve un
                 comando esplicito. -->
            <button
              v-if="ui.narrow"
              class="clear-btn close-btn"
              title="Chiudi"
              @click="close"
            >
              <Icon icon="lucide:x" />
            </button>
          </div>

          <!-- Scorre solo l'elenco: il campo resta in vista mentre si sfoglia,
               e il riquadro non cambia altezza a ogni tasto. -->
          <div class="panel-body">
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
              <span class="result-top">
                <Icon v-if="item.note.pinned" icon="lucide:star" class="pin-icon" />
                <span class="result-title">{{ item.note.title || 'Nuova nota' }}</span>
              </span>
              <span class="result-meta">
                <Icon :icon="item.note.trashed ? 'lucide:trash-2' : 'lucide:folder'" />
                {{ item.folderName }}
                <span class="result-date">{{ formatNoteDate(item.note.updatedAt) }}</span>
              </span>
              <span class="result-snippet">{{ item.snippet || notePreview(item.note.content) }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useNotesStore } from '../stores/notes'
import { useUiStore } from '../stores/ui'
import { stripHtml } from '../utils/markdown'
import { formatNoteDate, notePreview } from '../utils/noteDisplay'
import { isMac } from '../utils/shortcuts'

const store = useNotesStore()
const ui = useUiStore()

const panelOpen = ref(false)
const query = ref('')
const highlighted = ref(0)
const inputEl = ref(null)
const wrapEl = ref(null)
const panelEl = ref(null)

const searchHint = computed(() => (isMac ? '⇧⌘F' : 'Ctrl+Shift+F'))

const MAX_RESULTS = 40
const MAX_RECENTS = 8

// Note recenti quando la query è vuota: dà al pannello un contenuto utile
// appena si apre, invece di un riquadro vuoto.
const recents = computed(() =>
  store.notes
    .filter((n) => !n.trashed)
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_RECENTS)
    .map((note) => ({ note, folderName: folderNameFor(note), snippet: '' }))
)

// Cerca su tutte le note, indipendentemente da selectedFolderId: è la
// differenza rispetto a visibleNotes, che filtra prima per cartella.
// Il limite evita di costruire centinaia di nodi per una query di una
// lettera; stripHtml è la stessa funzione dell'anteprima nella lista, così si
// cerca nel testo che si legge e non nei tag.
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  const out = []
  for (const note of store.notes) {
    const body = stripHtml(note.content || '')
    if (!`${note.title || ''} ${body}`.toLowerCase().includes(q)) continue
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
// un risultato invece dell'inizio del testo, che spesso non la contiene.
function snippetAround(body, q) {
  if (!body) return ''
  const at = body.toLowerCase().indexOf(q)
  const start = at === -1 ? 0 : Math.max(0, at - 32)
  const text = body.slice(start, start + 110).replace(/\s+/g, ' ').trim()
  return (start > 0 ? '…' : '') + text + (start + 110 < body.length ? '…' : '')
}

// Esposta al genitore per la voce di menu ⇧⌘F.
async function openSearch() {
  panelOpen.value = true
  await nextTick()
  inputEl.value?.focus()
  inputEl.value?.select()
}

function close() {
  panelOpen.value = false
  inputEl.value?.blur()
}

function toggle() {
  panelOpen.value ? close() : openSearch()
}

function clearQuery() {
  query.value = ''
  inputEl.value?.focus()
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
  // revealNote e non selectNote: il risultato può stare in un'altra cartella,
  // e la lista non lo mostrerebbe.
  store.revealNote(noteId)
  query.value = ''
  close()
}

// Una nuova query invalida la posizione precedente nella lista.
watch(query, () => {
  highlighted.value = 0
})

// Il pannello e' teleportato su <body>, quindi NON e' dentro wrapEl: senza
// controllarlo a parte, ogni click al suo interno (campo, risultato)
// risulterebbe "fuori" e lo chiuderebbe subito.
function onGlobalMousedown(event) {
  if (!panelOpen.value) return
  const dentroIcona = wrapEl.value?.contains(event.target)
  const dentroPannello = panelEl.value?.contains(event.target)
  if (!dentroIcona && !dentroPannello) close()
}

onMounted(() => {
  window.addEventListener('mousedown', onGlobalMousedown)
})
onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onGlobalMousedown)
})

defineExpose({ openSearch })
</script>

<style scoped>
.global-search {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.icon-btn {
  border: none;
  background: transparent;
  color: var(--icon-color);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  font-size: 15px;
  display: flex;
  align-items: center;
  outline: none;
}
.icon-btn:hover,
.icon-btn.active {
  background: var(--sidebar-hover-bg);
  color: var(--p-text-color);
}

:global(.search-overlay) {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.34);
}

/* Altezza fissa e non max-height: il riquadro non deve crescere e rimpicciolirsi
   sotto le dita mentre si digita. */
:global(.search-panel) {
  display: flex;
  flex-direction: column;
  width: min(680px, 92vw);
  height: min(560px, 74vh);
  overflow: hidden;
  background: var(--editor-toolbar-bg);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.38);
}

/* A finestra stretta prende tutto: bordi e angoli tondi non hanno senso
   quando non c'e' niente attorno da cui staccarsi. */
:global(.search-overlay.is-fullscreen) {
  background: none;
}
:global(.search-overlay.is-fullscreen .search-panel) {
  width: 100%;
  height: 100%;
  border: none;
  border-radius: 0;
  box-shadow: none;
}
/* A tutta pagina il campo finisce sotto i tre tasti finestra, che macOS
   disegna sopra la webview: stesso rientro delle altre bande in cima. */
:global(.search-overlay.is-fullscreen .panel-field) {
  padding-left: 74px;
}

:global(.panel-body) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px;
}

:global(.panel-field) {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 14px;
  background: var(--editor-toolbar-bg);
  border-bottom: 1px solid var(--p-content-border-color);
}
:global(.field-icon) {
  font-size: 14px;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}
:global(.panel-field input) {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--p-text-color);
  font-size: 15px;
  outline: none;
}
:global(.clear-btn) {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--icon-color);
  cursor: pointer;
  display: flex;
  padding: 2px;
  border-radius: 4px;
}
:global(.clear-btn:hover) {
  color: var(--p-text-color);
}
:global(.close-btn) {
  font-size: 17px;
}

:global(.panel-label) {
  padding: 6px 10px 4px;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--p-text-muted-color);
}
:global(.panel-empty) {
  margin: 0;
  padding: 8px 10px 12px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}

/* Stessa struttura della voce nella lista note: titolo in grassetto, sotto
   cartella, ora e anteprima. */
:global(.result) {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}
/* Un solo stato visivo per mouse e tastiera: highlighted segue anche
   mouseenter, così non si vedono due righe "attive" insieme. */
:global(.result.highlighted) {
  background: var(--sidebar-hover-bg);
}

:global(.result-top) {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
:global(.result-title) {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
:global(.result-top .pin-icon) {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--icon-color);
}

:global(.result-meta) {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--p-text-muted-color);
  min-width: 0;
}
:global(.result-date) {
  margin-left: auto;
  flex-shrink: 0;
}

:global(.result-snippet) {
  font-size: 12px;
  color: var(--p-text-muted-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
