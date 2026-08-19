<template>
  <aside class="sidebar">
    <div class="sidebar-topbar">
      <div class="drag-spacer"></div>
      <button class="icon-btn" title="Nascondi sidebar" @click="emit('toggle-sidebar')">
        <Icon icon="lucide:panel-left-close" />
      </button>
    </div>

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

    <nav class="sidebar-section folders">
      <div
        v-for="folder in store.folders"
        :key="folder.id"
        class="sidebar-item folder-item"
        :class="{ active: store.selectedFolderId === folder.id }"
        @click="store.selectFolder(folder.id)"
        @contextmenu.prevent="onContextMenu($event, folder)"
        @dblclick="startRename(folder)"
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

    <!-- In fondo, non in alto: allineati in cima si sovrapponevano ai tasti
         del semaforo macOS (chiudi/minimizza/zoom, in alto a sinistra della
         finestra) quando la sidebar è ridotta in larghezza. -->
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
import { nextTick, ref } from 'vue'
import ContextMenu from 'primevue/contextmenu'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { Icon } from '@iconify/vue'
import { useNotesStore } from '../stores/notes'
import { useUiStore } from '../stores/ui'
import { useUpdateCheckStore } from '../stores/updateCheck'

const emit = defineEmits(['toggle-sidebar'])

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
  padding: 0 8px 12px;
  overflow-y: auto;
}

.sidebar-topbar {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 40px;
  flex-shrink: 0;
  -webkit-app-region: drag;
}
.drag-spacer {
  flex: 1;
}
.sidebar-topbar .icon-btn {
  -webkit-app-region: no-drag;
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
