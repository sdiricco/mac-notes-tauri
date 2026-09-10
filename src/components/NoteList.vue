<template>
  <section class="note-list">
    <!-- L'header resta sempre quello normale: la selezione multipla non lo
         sostituisce più, vive allo stesso livello della barra di
         ordinamento (vedi sort-row), così la vista non "salta" cambiando
         del tutto struttura quando si entra/esce dalla modalità. -->
    <!-- Banda superiore, alla quota dei tre tasti finestra: freccia a
         sinistra (dopo di loro) e creazione all'estrema destra. Il rientro
         sinistro scavalca i semafori, che cadono qui sopra sia a pannello nel
         flusso sia a pannello sovrapposto (parte comunque dall'angolo). -->
    <div class="note-list-topbar">
      <!-- Freccia indietro: porta il pannello alla vista cartelle. E' un solo
           pannello con due viste, non due affiancati. -->
      <button class="icon-btn back-btn" :title="t('list.folders')" @click="ui.showFolders()">
        <Icon icon="lucide:arrow-left" />
      </button>
      <!-- Avanti disabilitato: le note sono l'ultimo livello, non c'e' nulla
           oltre. Presente comunque perche' la coppia avanti/indietro sta in
           entrambe le viste: sparendo, i pulsanti accanto ballerebbero di
           posizione al cambio vista. -->
      <button class="icon-btn" :title="t('store.notes')" disabled>
        <Icon icon="lucide:arrow-right" />
      </button>

      <!-- Ricerca su tutte le cartelle, accanto alla creazione: sono le due
           azioni della banda, allineate a destra. Il suo pannello e'
           teleportato su <body>, quindi non lo ritaglia il pannello
           laterale. -->
      <GlobalSearch ref="globalSearchRef" class="search-in-topbar" />

      <button
        v-if="!store.isTrashView"
        class="icon-btn create-btn"
        :title="t('list.newNote')"
        @click="store.createNote()"
      >
        <Icon icon="lucide:square-pen" />
      </button>
      <button
        v-else
        class="icon-btn danger create-btn"
        :title="t('list.emptyTrash')"
        :disabled="store.trashCount === 0"
        @click="confirmEmptyTrash"
      >
        <Icon icon="lucide:trash-2" />
      </button>
    </div>

    <div class="note-list-header">
      <h2>{{ store.currentViewName }}</h2>
    </div>

    <!-- Due punti d'ingresso per la selezione multipla: questo bottone
         dedicato e la voce "Seleziona note" nel menu "⋮" di una nota (vedi
         noteMenuItems), che parte già con quella nota pre-selezionata. -->
    <div class="sort-row">
      <template v-if="!selectionMode">
        <button
          v-if="store.visibleNotes.length"
          class="icon-btn"
          :title="t('list.selectNotes')"
          @click="enterSelectionMode"
        >
          <Icon icon="lucide:list-checks" />
        </button>
        <button class="sort-bar select-mode-btn" :title="t('list.sortAndFilter')" @click="sortMenu.toggle($event)">
          <Icon :icon="settings.sortDir === 'asc' ? 'lucide:arrow-up-narrow-wide' : 'lucide:arrow-down-wide-narrow'" />
          <span class="sort-current">{{ sortLabel }}</span>
          <span v-if="settings.pinnedOnly" class="sort-filter">
            <Icon icon="lucide:star" /> {{ t('list.pinnedFilter') }}
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
        <!-- Non nel cestino: lì una nota va prima ripristinata, spostarla in
             una cartella restando cestinata sarebbe solo confusionario. -->
        <button
          v-if="!store.isTrashView"
          class="icon-btn"
          :title="t('list.moveToFolder')"
          :disabled="selectedIds.size === 0"
          @click="moveMenu.toggle($event)"
        >
          <Icon icon="lucide:folder-input" />
        </button>
        <button
          class="icon-btn danger"
          :title="store.isTrashView ? t('list.deletePermanently') : t('list.moveToTrash')"
          :disabled="selectedIds.size === 0"
          @click="confirmBulkDelete"
        >
          <Icon icon="lucide:trash-2" />
        </button>
        <button class="icon-btn select-mode-btn" :title="t('list.cancelSelection')" @click="exitSelectionMode">
          <Icon icon="lucide:x" />
        </button>
      </template>
    </div>

    <div class="note-items">
      <div v-if="store.visibleNotes.length === 0" class="empty-state">
        <Icon icon="lucide:inbox" />
        <p>{{ t('list.empty') }}</p>
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
          <span v-else class="note-title">{{ note.title || t('common.untitledNote') }}</span>
          <button v-if="!selectionMode" class="kebab" :title="t('list.actions')" @click.stop="openMenu($event, note)">
            <Icon icon="lucide:ellipsis" />
          </button>
        </div>
        <div class="note-meta">
          <span class="note-date">{{ formatNoteDate(note.updatedAt) }}</span>
          <span class="note-preview">{{ notePreview(note.content) }}</span>
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

    <!-- Destinazioni per la selezione multipla. Stesso modello di voci del
         gruppo "Sposta in" nel menu contestuale (folderTargetItems). -->
    <Menu ref="moveMenu" :model="moveMenuItems" :popup="true">
      <template #start>
        <div class="menu-title">
          {{ t('list.moveMenuTitle', selectedIds.size) }}
        </div>
      </template>
      <template #item="{ item, props }">
        <a class="menu-row" v-bind="props.action">
          <Icon :icon="item.icon" />
          <span>{{ item.label }}</span>
        </a>
      </template>
    </Menu>

    <!-- Menu ordinamento / filtri -->
    <Menu ref="sortMenu" :model="sortMenuItems" :popup="true">
      <template #start>
        <div class="menu-title">{{ t('list.sortBy') }}</div>
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
            {{ settings.sortDir === 'asc' ? t('list.ascending') : t('list.descending') }}
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
import { useI18n } from 'vue-i18n'
import { useNotesStore } from '../stores/notes'
import { useSettingsStore } from '../stores/settings'
import { useUiStore } from '../stores/ui'
import GlobalSearch from './GlobalSearch.vue'
import { stripHtml, htmlToMarkdown } from '../utils/markdown'
import { formatNoteDate, notePreview } from '../utils/noteDisplay'

const { t } = useI18n()
const store = useNotesStore()
const settings = useSettingsStore()
const ui = useUiStore()
const globalSearchRef = ref(null)
const confirm = useConfirm()
const toast = useToast()

const noteMenu = ref(null)
const sortMenu = ref(null)
const moveMenu = ref(null)
const menuTargetNote = ref(null)

const renamingId = ref(null)
const renameValue = ref('')
const renameInput = ref(null)

const SORT_LABELS = computed(() => ({
  updated: t('list.sort.updated'),
  created: t('list.sort.created'),
  title: t('list.sort.title')
}))
const sortLabel = computed(() => SORT_LABELS.value[settings.sortKey] || SORT_LABELS.value.updated)

// Voci di destinazione condivise fra il menu contestuale di una nota e il
// menu della selezione multipla: cambia solo su quali id agiscono.
// "Senza cartella" (folderId null) e' una destinazione valida come le altre,
// coerente con createNote che lascia null fuori dalle cartelle.
function folderTargetItems(ids, currentFolderId) {
  const targets = [...store.folders, { id: null, name: t('list.noFolder') }]
  return targets.map((folder) => ({
    label: folder.name,
    icon: folder.id === null ? 'lucide:folder-minus' : 'lucide:folder',
    // La cartella in cui la nota si trova gia' resta visibile ma inerte:
    // nasconderla farebbe "ballare" l'elenco fra note diverse.
    disabled: ids.length === 1 && folder.id === currentFolderId,
    command: () => moveTo(ids, folder.id, folder.name)
  }))
}

function moveTo(ids, folderId, folderName) {
  if (!ids.length) return
  store.moveNotesToFolder(ids, folderId)
  toast.add({
    severity: 'success',
    summary: t('list.toast.moved', ids.length),
    detail: t('list.toast.movedDestination', { name: folderName }),
    life: 1800
  })
  if (selectionMode.value) exitSelectionMode()
}

const noteMenuItems = computed(() => {
  const note = menuTargetNote.value
  if (!note) return []
  if (note.trashed) {
    return [
      { label: t('list.menu.restore'), icon: 'lucide:rotate-ccw', command: () => store.restoreNote(note.id) },
      { label: t('list.selectNotes'), icon: 'lucide:list-checks', command: () => startSelectionFrom(note) },
      {
        label: t('list.deletePermanently'),
        icon: 'lucide:trash-2',
        danger: true,
        command: () => store.deleteNotePermanently(note.id)
      }
    ]
  }
  return [
    { label: t('list.menu.rename'), icon: 'lucide:pencil', command: () => startRename(note) },
    { label: t('list.menu.duplicate'), icon: 'lucide:copy-plus', command: () => store.duplicateNote(note.id) },
    { label: t('list.menu.copyText'), icon: 'lucide:clipboard', command: () => copyText(note) },
    { label: t('list.menu.copyMarkdown'), icon: 'lucide:clipboard-list', command: () => copyMarkdown(note) },
    { separator: true },
    {
      label: note.pinned ? t('list.menu.removeFromPinned') : t('list.menu.addToPinned'),
      icon: 'lucide:star',
      command: () => store.togglePin(note.id)
    },
    { label: t('list.selectNotes'), icon: 'lucide:list-checks', command: () => startSelectionFrom(note) },
    {
      label: t('list.moveToTrash'),
      icon: 'lucide:trash-2',
      danger: true,
      command: () => store.trashNote(note.id)
    },
    // Gruppo, non sottomenu a comparsa: il Menu di PrimeVue rende `items`
    // come elenco piatto con intestazione (vedi Menu.vue, submenuLabel),
    // e in cambio si evita di dover aprire un popup da dentro un altro.
    { label: t('list.menu.moveTo'), items: folderTargetItems([note.id], note.folderId) }
  ]
})

// Destinazioni per le note selezionate. currentFolderId non serve: con piu'
// note le cartelle di partenza possono essere diverse.
const moveMenuItems = computed(() => folderTargetItems([...selectedIds]))

const sortMenuItems = computed(() => [
  { label: t('list.sort.updated'), icon: 'lucide:clock', sortKey: 'updated', command: () => settings.setSort('updated') },
  { label: t('list.sort.created'), icon: 'lucide:calendar', sortKey: 'created', command: () => settings.setSort('created') },
  { label: t('list.sort.title'), icon: 'lucide:case-sensitive', sortKey: 'title', command: () => settings.setSort('title') },
  ...(store.isPinnedView
    ? []
    : [
        { separator: true },
        { label: t('list.sort.pinnedOnly'), icon: 'lucide:star', filter: true, command: () => settings.togglePinnedOnly() }
      ])
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
  toast.add({ severity: 'success', summary: t('list.toast.textCopied'), life: 1800 })
}

async function copyMarkdown(note) {
  await navigator.clipboard.writeText(htmlToMarkdown(note.content))
  toast.add({ severity: 'success', summary: t('list.toast.markdownCopied'), life: 1800 })
}

function confirmEmptyTrash() {
  confirm.require({
    message: t('list.confirm.emptyTrashMessage'),
    header: t('list.emptyTrash'),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('list.confirm.emptyTrashAccept'),
    rejectLabel: t('list.confirm.cancel'),
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
  if (store.isTrashView) {
    confirm.require({
      message: t('list.confirm.bulkDeleteMessage', count),
      header: t('list.deletePermanently'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: t('list.confirm.delete'),
      rejectLabel: t('list.confirm.cancel'),
      acceptClass: 'p-button-danger',
      rejectClass: 'p-button-secondary',
      accept: () => {
        store.deleteNotesPermanently(ids)
        exitSelectionMode()
      }
    })
  } else {
    // Nel cestino si ripristina, quindi non si chiede conferma. Il toast
    // resta perche' qui le note spariscono in blocco e la selezione si
    // chiude: senza, non si vedrebbe *quante* ne sono andate.
    store.trashNotes(ids)
    exitSelectionMode()
    toast.add({
      severity: 'success',
      summary: t('list.toast.trashed', count),
      life: 1800
    })
  }
}

// Cambiare cartella/vista con una selezione attiva lascerebbe selezionati id
// di note non più visibili: si esce dalla modalità invece di trascinare uno
// stato ambiguo tra viste diverse.
watch(() => store.selectedFolderId, exitSelectionMode)



// Esposta ad App.vue per la voce di menu ⇧⌘F.
defineExpose({ openSearch: () => globalSearchRef.value?.openSearch() })
</script>

<style scoped>
/* Nessun border-right: la linea di separazione la disegna il divisorio
   ridimensionabile in App.vue, altrimenti se ne vedrebbero due. */
.note-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  /* Nessuno sfondo proprio: con un pannello unico le due viste devono
     avere lo stesso colore, e lo fornisce .sidebar-panel. Con --list-bg la
     vista note risultava di una tinta diversa dalle cartelle. */
}

.note-list-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 8px;
}
/* Banda alla quota dei semafori: stessa altezza dell'header della colonna di
   destra (40px), così i due allineamenti coincidono — se si cambia una,
   vanno cambiate insieme anche l'altra, il rientro della vista cartelle, la
   striscia di trascinamento e trafficLightPosition.y in tauri.conf.json.
   Per quel valore: in tao lo spostamento del pulsante e' (y - b), con b il
   margine del pulsante nel contenitore originale. Misurato sul campo, il
   centro dei semafori coincide con y, quindi per centrarli in una banda
   alta H serve y = H/2 (40 -> 20). La stima iniziale y = H/2 + 2 partiva
   da pulsanti alti 12px: sono 14.
   Il rientro sinistro lascia passare i tre tasti finestra. */
.note-list-topbar {
  display: flex;
  align-items: center;
  height: 38px; /* = barra del titolo nativa, vedi titlebar.rs */
  flex-shrink: 0;
  padding: 0 12px 0 72px; /* i semafori finiscono a x=66 */
}
/* La freccia non si restringe mai: e' l'unico modo di tornare alle
   cartelle. Il margine la stacca dai tre tasti finestra, che le stanno
   subito a sinistra. */
.back-btn {
  flex-shrink: 0;
  margin-left: 8px;
}
/* Ricerca e creazione formano il gruppo di destra: e' la ricerca a essere
   spinta in fondo, e la creazione la segue. */
.search-in-topbar {
  margin-left: auto;
}
.create-btn {
  flex-shrink: 0;
}

/* Non piu' flex: 1 — crescendo spingeva la ricerca fino al gruppo di destra.
   Ora il titolo occupa il suo spazio, la ricerca gli sta accanto e le azioni
   vengono spinte in fondo dal margin-left: auto. min-width: 0 con il
   troncamento fa cedere il titolo invece di far uscire la ricerca. */
.note-list-header h2 {
  flex: 0 1 auto;
  min-width: 0;
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  /* Invisibile finche' non si passa sulla riga, ma con opacity: 0 restava
     CLICCABILE: un click che gli capitava sopra apriva il menu della nota
     invece di aprire la nota. Con il pannello unico, piu' stretto, il "⋮"
     cade molto piu' vicino al punto in cui si clicca il titolo.
     pointer-events: none lo rende inerte quando non si vede. */
  opacity: 0;
  pointer-events: none;
  outline: none;
}
.note-item:hover .kebab,
.note-item.active .kebab {
  opacity: 1;
  pointer-events: auto;
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
/* Intestazione dei gruppi (il "Sposta in" del menu contestuale): PrimeVue la
   rende come .p-menu-submenu-label, fuori dal template #item. Le si da' lo
   stesso aspetto di .menu-title per non avere due stili di intestazione. */
:deep(.p-menu-submenu-label) {
  padding: 8px 12px 2px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color);
  background: transparent;
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
