<template>
  <aside class="sidebar">
    <nav class="sidebar-section">
      <button
        class="sidebar-item"
        :class="{ active: store.isAllView }"
        @click="store.selectFolder('all')"
      >
        <Icon icon="lucide:notebook-text" />
        <span>Tutte le Note</span>
        <span class="count">{{ store.allCount }}</span>
      </button>
      <button
        class="sidebar-item"
        :class="{ active: store.isPinnedView }"
        @click="store.selectFolder('pinned')"
      >
        <Icon icon="lucide:star" />
        <span>Preferiti</span>
        <span class="count">{{ store.pinnedCount }}</span>
      </button>
      <button
        class="sidebar-item"
        :class="{ active: store.isTrashView }"
        @click="store.selectFolder('trash')"
      >
        <Icon icon="lucide:trash-2" />
        <span>Cestino</span>
        <span class="count">{{ store.trashCount }}</span>
      </button>
    </nav>

    <div class="sidebar-header">
      <span>Cartelle</span>
      <button class="icon-btn" title="Nuova cartella" @click="startNewFolder">
        <Icon icon="lucide:plus" />
      </button>
    </div>

    <!-- Riordino con eventi puntatore e non con il drag & drop HTML5: su
         Windows quest'ultimo richiede di disattivare dragDropEnabled (che
         intercetta il drop dei file a livello nativo), e il comportamento
         nelle tre webview non e' uniforme. Qui e' identico su ogni
         piattaforma. -->
    <nav ref="folderListEl" class="sidebar-section folders">
      <div
        v-for="(folder, index) in store.folders"
        :key="folder.id"
        class="sidebar-item folder-item"
        :class="{
          active: store.selectedFolderId === folder.id,
          dragging: dragIndex === index,
          'drop-before': dropIndex === index && dragIndex !== index,
          'drop-after': dropIndex === store.folders.length && index === store.folders.length - 1
        }"
        @click="onFolderClick(folder)"
        @contextmenu.prevent="onContextMenu($event, folder)"
        @dblclick="startRename(folder)"
        @mousedown="onFolderMousedown($event, index, folder)"
      >
        <Icon icon="lucide:folder" />
        <input
          v-if="renamingId === folder.id"
          ref="renameInput"
          v-model="renameValue"
          class="rename-input"
          @click.stop
          @keyup.enter="commitRename(folder)"
          @keyup.esc="renamingId = null"
          @blur="commitRename(folder)"
        />
        <span v-else class="folder-name">{{ folder.name }}</span>
        <span class="count">{{ store.folderCount(folder.id) }}</span>
      </div>

      <div v-if="creatingFolder" class="sidebar-item folder-item">
        <Icon icon="lucide:folder" />
        <input
          ref="newFolderInput"
          v-model="newFolderName"
          class="rename-input"
          placeholder="Nome cartella"
          @keyup.enter="commitNewFolder"
          @keyup.esc="creatingFolder = false"
          @blur="commitNewFolder"
        />
      </div>
    </nav>

    <!-- In fondo, non in alto: sono azioni secondarie, e in cima ruberebbero
         attenzione a cartelle e viste. -->
    <div class="sidebar-footer">
      <button
        v-if="updateCheck.available"
        class="update-btn"
        :title="`Versione ${updateCheck.latestVersion} disponibile (attuale: ${updateCheck.currentVersion})`"
        @click="onUpdateClick"
      >
        <Icon icon="lucide:arrow-up-circle" />
        <span>Aggiorna</span>
      </button>
      <button class="sidebar-item" title="Impostazioni" @click="ui.openSettings()">
        <Icon icon="lucide:settings" />
        <span>Impostazioni</span>
      </button>
    </div>

    <ContextMenu ref="menu" :model="menuItems">
      <template #item="{ item, props }">
        <a class="menu-row" v-bind="props.action">
          <Icon :icon="item.icon" />
          <span>{{ item.label }}</span>
        </a>
      </template>
    </ContextMenu>
  </aside>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue'
import ContextMenu from 'primevue/contextmenu'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { Icon } from '@iconify/vue'
import { useNotesStore } from '../stores/notes'
import { useUiStore } from '../stores/ui'
import { useUpdateCheckStore } from '../stores/updateCheck'

const store = useNotesStore()
const ui = useUiStore()
const updateCheck = useUpdateCheckStore()
const confirm = useConfirm()
const toast = useToast()

const UPDATE_CMD = 'brew upgrade --cask mac-notes'

async function onUpdateClick() {
  try {
    await navigator.clipboard.writeText(UPDATE_CMD)
    toast.add({
      severity: 'info',
      summary: `Versione ${updateCheck.latestVersion} disponibile`,
      detail: `Comando copiato: ${UPDATE_CMD}`,
      life: 4000
    })
  } catch {
    toast.add({
      severity: 'info',
      summary: `Versione ${updateCheck.latestVersion} disponibile`,
      detail: `Esegui: ${UPDATE_CMD}`,
      life: 5000
    })
  }
}

// --- Riordino delle cartelle -------------------------------------------
// Il trascinamento parte solo dopo DRAG_THRESHOLD px: sotto quella soglia
// l'interazione resta un click (seleziona la cartella) o un doppio click
// (rinomina), che altrimenti verrebbero mangiati dal drag.
const DRAG_THRESHOLD = 4

const folderListEl = ref(null)
const dragIndex = ref(-1)
const dropIndex = ref(-1)
let pending = null // { index, startY, folder } prima del superamento soglia
let suppressClick = false

function onFolderMousedown(event, index, folder) {
  // Durante la rinomina c'e' un <input>: trascinare impedirebbe di
  // selezionare il testo con il mouse.
  if (renamingId.value === folder.id) return
  if (event.button !== 0) return
  pending = { index, startY: event.clientY }
  window.addEventListener('mousemove', onFolderMousemove)
  window.addEventListener('mouseup', onFolderMouseup)
}

function onFolderMousemove(event) {
  if (!pending) return
  if (dragIndex.value === -1) {
    if (Math.abs(event.clientY - pending.startY) < DRAG_THRESHOLD) return
    dragIndex.value = pending.index
    document.body.classList.add('is-reordering')
  }
  dropIndex.value = dropIndexFor(event.clientY)
}

// Indice di *inserimento*: 0..length. Si guarda il punto medio di ogni riga,
// così passando la metà superiore si inserisce prima e oltre la metà
// inferiore dopo — il comportamento atteso di un riordino per trascinamento.
function dropIndexFor(clientY) {
  // Solo le righe delle cartelle esistenti: mentre si crea una cartella nuova
  // il <nav> contiene una riga in piu' (l'input), che falserebbe gli indici.
  // E' resa dopo il v-for, quindi basta troncare.
  const rows = [...(folderListEl.value?.children || [])].slice(0, store.folders.length)
  for (let i = 0; i < rows.length; i++) {
    const rect = rows[i].getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) return i
  }
  return rows.length
}

function onFolderMouseup() {
  if (dragIndex.value !== -1 && dropIndex.value !== -1) {
    // dropIndex e' un indice di inserimento nella lista *con* l'elemento
    // ancora al suo posto: rimuovendolo, ogni posizione successiva scala di
    // uno. Senza questa correzione trascinare verso il basso finisce sempre
    // una posizione troppo in alto.
    const target = dropIndex.value > dragIndex.value ? dropIndex.value - 1 : dropIndex.value
    store.reorderFolders(dragIndex.value, target)
    // Il mouseup genera anche un click sulla riga: qui non deve selezionare.
    suppressClick = true
  }
  endFolderDrag()
}

function endFolderDrag() {
  pending = null
  dragIndex.value = -1
  dropIndex.value = -1
  document.body.classList.remove('is-reordering')
  window.removeEventListener('mousemove', onFolderMousemove)
  window.removeEventListener('mouseup', onFolderMouseup)
}

function onFolderClick(folder) {
  if (suppressClick) {
    suppressClick = false
    return
  }
  store.selectFolder(folder.id)
}

onBeforeUnmount(endFolderDrag)

const renamingId = ref(null)
const renameValue = ref('')
const renameInput = ref(null)

const creatingFolder = ref(false)
const newFolderName = ref('')
const newFolderInput = ref(null)

const menu = ref(null)
const menuTargetFolder = ref(null)
const menuItems = ref([
  {
    label: 'Rinomina',
    icon: 'lucide:pencil',
    command: () => startRename(menuTargetFolder.value)
  },
  {
    label: 'Elimina cartella',
    icon: 'lucide:trash-2',
    command: () => removeFolder(menuTargetFolder.value)
  }
])

function onContextMenu(event, folder) {
  menuTargetFolder.value = folder
  menu.value.show(event)
}

function startRename(folder) {
  renamingId.value = folder.id
  renameValue.value = folder.name
  nextTick(() => renameInput.value?.[0]?.focus())
}

function commitRename(folder) {
  if (renamingId.value !== folder.id) return
  store.renameFolder(folder.id, renameValue.value)
  renamingId.value = null
}

function startNewFolder() {
  creatingFolder.value = true
  newFolderName.value = ''
  nextTick(() => newFolderInput.value?.focus())
}

function commitNewFolder() {
  if (!creatingFolder.value) return
  if (newFolderName.value.trim()) {
    const folder = store.createFolder(newFolderName.value)
    store.selectFolder(folder.id)
  }
  creatingFolder.value = false
}

function removeFolder(folder) {
  if (!folder) return
  confirm.require({
    message: `Eliminare la cartella "${folder.name}"? Le note verranno spostate nel cestino.`,
    header: 'Elimina cartella',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Elimina',
    rejectLabel: 'Annulla',
    acceptClass: 'p-button-danger',
    rejectClass: 'p-button-secondary',
    accept: () => store.deleteFolder(folder.id)
  })
}
</script>

<style scoped>
.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--sidebar-bg);
  padding: 10px 8px 12px;
  overflow-y: auto;
}

.sidebar-footer {
  flex-shrink: 0;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--p-content-border-color);
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.update-btn {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;
  border: none;
  background: var(--selection-bg);
  color: var(--p-text-color);
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
}
.update-btn:hover {
  background: var(--sidebar-hover-bg);
}
.update-btn :deep(svg) {
  font-size: 15px;
  flex-shrink: 0;
  color: var(--icon-color);
}

/* Riordino: la riga trascinata sbiadisce, e una linea segna il punto di
   inserimento. La linea e' un ::before/::after in position:absolute così non
   sposta nulla nel layout mentre la si muove. */
.folder-item {
  position: relative;
}
.folder-item.dragging {
  opacity: 0.4;
}
.folder-item.drop-before::before,
.folder-item.drop-after::after {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  height: 2px;
  border-radius: 1px;
  background: var(--icon-color);
}
.folder-item.drop-before::before {
  top: -1px;
}
.folder-item.drop-after::after {
  bottom: -1px;
}

/* Durante il riordino il cursore resta coerente su tutta la finestra e nulla
   seleziona testo, anche se il puntatore esce dalla lista. */
body.is-reordering {
  cursor: grabbing;
  user-select: none;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-bottom: 12px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color);
}

.icon-btn {
  border: none;
  background: transparent;
  color: var(--icon-color);
  cursor: pointer;
  padding: 5px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  font-size: 16px;
}
.icon-btn:hover {
  background: var(--sidebar-hover-bg);
  color: var(--p-text-color);
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--p-text-color);
  cursor: pointer;
  text-align: left;
  width: 100%;
}

.sidebar-item :deep(svg) {
  font-size: 15px;
  flex-shrink: 0;
  color: var(--icon-color);
}

.sidebar-item:hover {
  background: var(--sidebar-hover-bg);
}

.sidebar-item.active {
  background: var(--selection-bg);
}
.sidebar-item.active :deep(svg) {
  color: var(--p-text-color);
}

.folder-name,
.sidebar-item span:not(.count) {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  font-size: 12px;
  color: var(--p-text-muted-color);
  flex: none;
}

.rename-input {
  flex: 1;
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  font-size: 13px;
  padding: 1px 4px;
  color: var(--p-text-color);
  outline: none;
}

.menu-row {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
}
.menu-row :deep(svg),
.menu-row svg {
  font-size: 15px;
  color: var(--icon-color);
}
</style>
