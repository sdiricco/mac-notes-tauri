<template>
  <section class="note-list">
    <div class="note-list-drag"></div>

    <!-- L'header resta sempre quello normale: la selezione multipla non lo
         sostituisce più, vive allo stesso livello della barra di
         ordinamento (vedi sort-row), così la vista non "salta" cambiando
         del tutto struttura quando si entra/esce dalla modalità. -->
    <div class="note-list-header" :class="{ inset: !sidebarVisible }">
      <h2>{{ folderTitle }}</h2>
      <div class="header-actions">
        <button
          v-if="!store.isTrashView"
          class="icon-btn"
          title="Nuova nota"
          @click="store.createNote()"
        >
          <Icon icon="lucide:square-pen" />
        </button>
        <button
          v-else
          class="icon-btn danger"
          title="Svuota cestino"
          :disabled="store.trashCount === 0"
          @click="confirmEmptyTrash"
        >
          <Icon icon="lucide:trash-2" />
        </button>
        <button
          v-if="!sidebarVisible"
          class="icon-btn"
          title="Mostra sidebar"
          @click="emit('toggle-sidebar')"
        >
          <Icon icon="lucide:panel-left-open" />
        </button>
      </div>
    </div>

    <div class="search-box">
      <Icon icon="lucide:search" />
      <input ref="searchInput" v-model="store.searchQuery" type="text" placeholder="Cerca" />
    </div>

    <!-- Due punti d'ingresso per la selezione multipla: questo bottone
         dedicato e la voce "Seleziona note" nel menu "⋮" di una nota (vedi
         noteMenuItems), che parte già con quella nota pre-selezionata. -->
    <div class="sort-row">
      <template v-if="!selectionMode">
        <button
          v-if="store.visibleNotes.length"
          class="icon-btn"
          title="Seleziona note"
          @click="enterSelectionMode"
        >
          <Icon icon="lucide:list-checks" />
        </button>
        <button class="sort-bar select-mode-btn" title="Ordina e filtra" @click="sortMenu.toggle($event)">
          <Icon :icon="settings.sortDir === 'asc' ? 'lucide:arrow-up-narrow-wide' : 'lucide:arrow-down-wide-narrow'" />
          <span class="sort-current">{{ sortLabel }}</span>
          <span v-if="settings.pinnedOnly" class="sort-filter">
            <Icon icon="lucide:star" /> preferiti
          </span>
          <Icon icon="lucide:chevron-down" class="sort-chevron" />
        </button>
      </template>
      <template v-else>
        <Checkbox
          binary
          :model-value="allVisibleSelected"
          :indeterminate="someVisibleSelected && !allVisibleSelected"
          @update:model-value="toggleSelectAll"
        />
        <span class="selection-count">{{ selectedIds.size }}/{{ store.visibleNotes.length }}</span>
        <button
          class="icon-btn danger"
          :title="store.isTrashView ? 'Elimina definitivamente' : 'Sposta nel cestino'"
          :disabled="selectedIds.size === 0"
          @click="confirmBulkDelete"
        >
          <Icon icon="lucide:trash-2" />
        </button>
        <button class="icon-btn select-mode-btn" title="Annulla selezione" @click="exitSelectionMode">
          <Icon icon="lucide:x" />
        </button>
      </template>
    </div>

    <div class="note-items">
      <div v-if="store.visibleNotes.length === 0" class="empty-state">
        <Icon icon="lucide:inbox" />
        <p>Nessuna nota</p>
      </div>

      <div
        v-for="note in store.visibleNotes"
        :key="note.id"
        class="note-item"
        :class="{ active: note.id === store.selectedNoteId, selected: selectedIds.has(note.id) }"
        @click="onItemClick(note)"
        @contextmenu.prevent="openMenu($event, note)"
      >
        <div class="note-item-top">
          <!-- @click.stop evita che il click sulla checkbox raddoppi il
               toggle facendo scattare anche onItemClick sulla riga. -->
          <Checkbox
            v-if="selectionMode"
            binary
            :model-value="selectedIds.has(note.id)"
            class="note-select-check"
            @click.stop
            @update:model-value="toggleNoteSelected(note.id)"
          />
          <Icon v-if="note.pinned" icon="lucide:star" class="pin-icon" />
          <input
            v-if="renamingId === note.id"
            ref="renameInput"
            v-model="renameValue"
            class="rename-input"
            @click.stop
            @keyup.enter="commitRename(note)"
            @keyup.esc="renamingId = null"
            @blur="commitRename(note)"
          />
          <span v-else class="note-title">{{ note.title || 'Nuova nota' }}</span>
          <button v-if="!selectionMode" class="kebab" title="Azioni" @click.stop="openMenu($event, note)">
            <Icon icon="lucide:ellipsis" />
          </button>
        </div>
        <div class="note-meta">
          <span class="note-date">{{ formatDate(note.updatedAt) }}</span>
          <span class="note-preview">{{ preview(note.content) }}</span>
        </div>
      </div>
    </div>

    <!-- Menu azioni per nota -->
    <Menu ref="noteMenu" :model="noteMenuItems" :popup="true">
      <template #item="{ item, props }">
        <a class="menu-row" :class="{ danger: item.danger }" v-bind="props.action">
          <Icon :icon="item.icon" />
          <span>{{ item.label }}</span>
        </a>
      </template>
    </Menu>

    <!-- Menu ordinamento / filtri -->
    <Menu ref="sortMenu" :model="sortMenuItems" :popup="true">
      <template #start>
        <div class="menu-title">Ordina per</div>
      </template>
      <template #item="{ item, props }">
        <a
          class="menu-row"
          :class="{ active: item.sortKey && settings.sortKey === item.sortKey }"
          v-bind="props.action"
        >
          <Icon :icon="item.icon" />
          <span class="grow">{{ item.label }}</span>
          <span v-if="item.sortKey && settings.sortKey === item.sortKey" class="sort-state">
            <Icon :icon="settings.sortDir === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'" />
            {{ settings.sortDir === 'asc' ? 'crescente' : 'decrescente' }}
          </span>
          <Icon v-else-if="item.filter && settings.pinnedOnly" icon="lucide:check" class="trail" />
        </a>
      </template>
    </Menu>
  </section>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import Menu from 'primevue/menu'
import Checkbox from 'primevue/checkbox'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { Icon } from '@iconify/vue'
import { useNotesStore } from '../stores/notes'
import { useSettingsStore } from '../stores/settings'
import { stripHtml, htmlToMarkdown } from '../utils/markdown'

defineProps({
  sidebarVisible: { type: Boolean, default: true }
})
const emit = defineEmits(['toggle-sidebar'])

const store = useNotesStore()
const settings = useSettingsStore()
const confirm = useConfirm()
const toast = useToast()

const searchInput = ref(null)
const noteMenu = ref(null)
const sortMenu = ref(null)
const menuTargetNote = ref(null)

const renamingId = ref(null)
const renameValue = ref('')
const renameInput = ref(null)

const folderTitle = computed(() => {
  if (store.isAllView) return 'Tutte le Note'
  if (store.isTrashView) return 'Cestino'
  return store.currentFolder?.name || 'Note'
})

const SORT_LABELS = {
  updated: 'Data modifica',
  created: 'Data creazione',
  title: 'Titolo'
}
const sortLabel = computed(() => SORT_LABELS[settings.sortKey] || 'Data modifica')

const noteMenuItems = computed(() => {
  const note = menuTargetNote.value
  if (!note) return []
  if (note.trashed) {
    return [
      { label: 'Ripristina', icon: 'lucide:rotate-ccw', command: () => store.restoreNote(note.id) },
      { label: 'Seleziona note', icon: 'lucide:list-checks', command: () => startSelectionFrom(note) },
      {
        label: 'Elimina definitivamente',
        icon: 'lucide:trash-2',
        danger: true,
        command: () => store.deleteNotePermanently(note.id)
      }
    ]
  }
  return [
    { label: 'Rinomina', icon: 'lucide:pencil', command: () => startRename(note) },
    { label: 'Duplica', icon: 'lucide:copy-plus', command: () => store.duplicateNote(note.id) },
    { label: 'Copia testo', icon: 'lucide:clipboard', command: () => copyText(note) },
    { label: 'Copia come Markdown', icon: 'lucide:clipboard-list', command: () => copyMarkdown(note) },
    { separator: true },
    {
      label: note.pinned ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti',
      icon: 'lucide:star',
      command: () => store.togglePin(note.id)
    },
    { label: 'Seleziona note', icon: 'lucide:list-checks', command: () => startSelectionFrom(note) },
    {
      label: 'Sposta nel cestino',
      icon: 'lucide:trash-2',
      danger: true,
      command: () => store.trashNote(note.id)
    }
  ]
})

const sortMenuItems = computed(() => [
  { label: 'Data modifica', icon: 'lucide:clock', sortKey: 'updated', command: () => settings.setSort('updated') },
  { label: 'Data creazione', icon: 'lucide:calendar', sortKey: 'created', command: () => settings.setSort('created') },
  { label: 'Titolo', icon: 'lucide:case-sensitive', sortKey: 'title', command: () => settings.setSort('title') },
  { separator: true },
  { label: 'Solo preferiti', icon: 'lucide:star', filter: true, command: () => settings.togglePinnedOnly() }
])

function openMenu(event, note) {
  menuTargetNote.value = note
  noteMenu.value.toggle(event)
}

function startRename(note) {
  store.selectNote(note.id)
  renamingId.value = note.id
  renameValue.value = note.title || ''
  nextTick(() => renameInput.value?.[0]?.focus())
}

function commitRename(note) {
  if (renamingId.value !== note.id) return
  store.updateNote(note.id, { title: renameValue.value.trim() })
  renamingId.value = null
}

async function copyText(note) {
  await navigator.clipboard.writeText(stripHtml(note.content))
  toast.add({ severity: 'success', summary: 'Testo copiato', life: 1800 })
}

async function copyMarkdown(note) {
  await navigator.clipboard.writeText(htmlToMarkdown(note.content))
  toast.add({ severity: 'success', summary: 'Markdown copiato', life: 1800 })
}

function confirmEmptyTrash() {
  confirm.require({
    message: 'Eliminare definitivamente tutte le note nel cestino?',
    header: 'Svuota cestino',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Svuota',
    rejectLabel: 'Annulla',
    acceptClass: 'p-button-danger',
    rejectClass: 'p-button-secondary',
    accept: () => store.emptyTrash()
  })
}

// Selezione multipla: sostituisce l'header e il comportamento di click sulle
// note (che diventa "seleziona" invece di "apri") per eliminarne più insieme
// senza dover ripetere Cmd+click nota-per-nota o passare dal menu singolo.
const selectionMode = ref(false)
const selectedIds = reactive(new Set())

function enterSelectionMode() {
  selectionMode.value = true
  selectedIds.clear()
}

// Punto d'ingresso della selezione multipla: dal menu "⋮" di una nota
// specifica (vedi noteMenuItems), che entra in modalità con quella nota già
// pre-selezionata invece di partire da una selezione vuota.
function startSelectionFrom(note) {
  enterSelectionMode()
  selectedIds.add(note.id)
}

function exitSelectionMode() {
  selectionMode.value = false
  selectedIds.clear()
}

function toggleNoteSelected(id) {
  if (selectedIds.has(id)) selectedIds.delete(id)
  else selectedIds.add(id)
}

function onItemClick(note) {
  if (selectionMode.value) toggleNoteSelected(note.id)
  else store.selectNote(note.id)
}

function selectAllVisible() {
  store.visibleNotes.forEach((note) => selectedIds.add(note.id))
}

// Checkbox "seleziona tutte" a 3 stati (vuota/indeterminata/piena): click
// seleziona tutte se non lo sono già, altrimenti deseleziona tutte.
const allVisibleSelected = computed(
  () => store.visibleNotes.length > 0 && store.visibleNotes.every((note) => selectedIds.has(note.id))
)
const someVisibleSelected = computed(() => store.visibleNotes.some((note) => selectedIds.has(note.id)))

function toggleSelectAll() {
  if (allVisibleSelected.value) selectedIds.clear()
  else selectAllVisible()
}

function confirmBulkDelete() {
  const ids = Array.from(selectedIds)
  if (!ids.length) return
  const count = ids.length
  const noun = count === 1 ? 'nota' : 'note'
  if (store.isTrashView) {
    confirm.require({
      message: `Eliminare definitivamente ${count} ${noun}? L'operazione non può essere annullata.`,
      header: 'Elimina definitivamente',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Elimina',
      rejectLabel: 'Annulla',
      acceptClass: 'p-button-danger',
      rejectClass: 'p-button-secondary',
      accept: () => {
        store.deleteNotesPermanently(ids)
        exitSelectionMode()
      }
    })
  } else {
    confirm.require({
      message: `Spostare ${count} ${noun} nel cestino?`,
      header: 'Sposta nel cestino',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sposta',
      rejectLabel: 'Annulla',
      acceptClass: 'p-button-danger',
      rejectClass: 'p-button-secondary',
      accept: () => {
        store.trashNotes(ids)
        exitSelectionMode()
      }
    })
  }
}

// Cambiare cartella/vista con una selezione attiva lascerebbe selezionati id
// di note non più visibili: si esce dalla modalità invece di trascinare uno
// stato ambiguo tra viste diverse.
watch(() => store.selectedFolderId, exitSelectionMode)

function preview(content) {
  const text = stripHtml(content)
  return text.length ? text : 'Nessun testo aggiuntivo'
}

function formatDate(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  if (isToday) {
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

defineExpose({ focusSearch: () => searchInput.value?.focus() })
</script>

<style scoped>
.note-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--list-bg);
  border-right: 1px solid var(--p-content-border-color);
}

/* Nessuna altezza fissa: era una striscia draggabile duplicata, la stessa
   funzione la assolve già note-list-header (anch'esso -webkit-app-region:drag).
   Lo spazio che dava è confluito nel padding-top dell'header, vedi sotto. */
.note-list-drag {
  -webkit-app-region: drag;
  flex-shrink: 0;
}

.note-list-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 8px;
  -webkit-app-region: drag;
}
/* quando la sidebar è chiusa i semafori della finestra coprono l'angolo: rientro */
.note-list-header.inset {
  padding-left: 74px;
}
.note-list-header h2 {
  flex: 1;
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.selection-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--p-text-color);
}

.icon-btn {
  border: none;
  background: transparent;
  color: var(--icon-color);
  cursor: pointer;
  padding: 5px;
  border-radius: 6px;
  font-size: 16px;
  display: flex;
  align-items: center;
  outline: none;
}
.icon-btn:hover {
  background: var(--sidebar-hover-bg);
  color: var(--p-text-color);
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.icon-btn.danger:hover {
  color: #e5484d;
}

.search-box {
  margin: 0 10px 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--search-bg);
  border-radius: 8px;
  padding: 6px 9px;
}
.search-box :deep(svg) {
  color: var(--p-text-muted-color);
  font-size: 14px;
  flex-shrink: 0;
}
.search-box input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  width: 100%;
  color: var(--p-text-color);
}

.sort-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0 10px 6px;
}
.sort-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--p-text-muted-color);
  font-size: 12px;
  cursor: pointer;
  width: fit-content;
  max-width: 100%;
  flex-shrink: 1;
  min-width: 0;
}
.select-mode-btn {
  flex-shrink: 0;
  margin-left: auto;
}
.sort-bar:hover {
  background: var(--sidebar-hover-bg);
}
.sort-bar :deep(svg) {
  font-size: 14px;
}
.sort-current {
  color: var(--p-text-color);
  font-weight: 500;
}
.sort-filter {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--p-text-color);
}
.sort-filter :deep(svg) {
  font-size: 11px;
}
.sort-chevron {
  margin-left: auto;
  opacity: 0.7;
}

.note-items {
  flex: 1;
  overflow-y: auto;
  padding: 2px 6px 8px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--p-text-muted-color);
  gap: 8px;
}
.empty-state :deep(svg) {
  font-size: 26px;
}

/* nota come card */
.note-item {
  padding: 8px 10px;
  border-radius: 9px;
  cursor: pointer;
  margin-bottom: 2px;
}
.note-item:hover {
  background: var(--sidebar-hover-bg);
}
.note-item.active {
  background: var(--card-bg);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.14);
}
.note-item.selected {
  background: var(--selection-bg);
}

.note-item-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Il tema Aura di default usa il verde (primary di PrimeVue) per lo stato
   selezionato: qui vogliamo il neutro scuro/chiaro già usato altrove per le
   azioni "primary" dell'app (es. .value-prompt-ok), non il verde. */
.note-select-check,
.sort-row :deep(.p-checkbox) {
  --p-checkbox-checked-background: var(--p-text-color);
  --p-checkbox-checked-hover-background: var(--p-text-color);
  --p-checkbox-checked-border-color: var(--p-text-color);
  --p-checkbox-checked-hover-border-color: var(--p-text-color);
  --p-checkbox-checked-focus-border-color: var(--p-text-color);
  --p-checkbox-icon-checked-color: var(--editor-bg);
  --p-checkbox-icon-checked-hover-color: var(--editor-bg);
  flex-shrink: 0;
}
/* .sort-row ha margin-left 10px, ma il checkbox di ogni nota è rientrato di
   16px (padding di .note-items + .note-item): senza questo margine il
   checkbox "seleziona tutte" risulta 6px più a sinistra della colonna dei
   checkbox delle note sotto, invece di stare allineato sopra di essa. */
.sort-row :deep(.p-checkbox) {
  margin-left: 6px;
}

.pin-icon {
  font-size: 11px;
  color: var(--icon-color);
  flex-shrink: 0;
}

.note-title {
  font-weight: 600;
  font-size: 13px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kebab {
  border: none;
  background: transparent;
  color: var(--icon-color);
  cursor: pointer;
  padding: 2px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  font-size: 15px;
  opacity: 0;
  outline: none;
}
.note-item:hover .kebab,
.note-item.active .kebab {
  opacity: 1;
}
.kebab:hover {
  background: var(--selection-bg);
  color: var(--p-text-color);
}

.rename-input {
  flex: 1;
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  font-size: 13px;
  padding: 1px 5px;
  color: var(--p-text-color);
  outline: none;
}

.note-meta {
  display: flex;
  gap: 6px;
  font-size: 12px;
  color: var(--p-text-muted-color);
  margin-top: 2px;
}
.note-date {
  flex-shrink: 0;
}
.note-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* righe dei menu popup */
.menu-row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
}
.menu-row .grow {
  flex: 1;
}
.menu-row :deep(svg),
.menu-row svg {
  font-size: 15px;
  color: var(--icon-color);
}
.menu-row.active {
  color: var(--p-text-color);
  font-weight: 600;
}
.menu-row.active :deep(svg) {
  color: var(--p-text-color);
}
.sort-state {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 400;
  color: var(--p-text-muted-color);
}
.sort-state :deep(svg) {
  font-size: 13px;
}
.menu-row .trail {
  font-size: 13px;
}
.menu-row.danger,
.menu-row.danger svg {
  color: #e5484d;
}
.menu-title {
  padding: 6px 12px 2px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color);
}

</style>
