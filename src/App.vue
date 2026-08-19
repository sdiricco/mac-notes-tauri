<template>
  <div v-if="!store.ready" class="loading">
    <Icon icon="lucide:loader-circle" class="spin" />
  </div>
  <template v-else>
    <Splitter class="app-shell" :gutter-size="1">
      <SplitterPanel
        v-show="ui.sidebarVisible"
        :size="15"
        :min-size="11"
        :max-size="22"
        class="panel sidebar-panel"
      >
        <Sidebar @toggle-sidebar="ui.toggleSidebar()" />
      </SplitterPanel>
      <SplitterPanel :size="21" :min-size="15" :max-size="32" class="panel">
        <NoteList ref="noteListRef" :sidebar-visible="ui.sidebarVisible" @toggle-sidebar="ui.toggleSidebar()" />
      </SplitterPanel>
      <SplitterPanel :size="64" class="panel">
        <NoteEditor />
      </SplitterPanel>
    </Splitter>

    <SettingsDialog />
    <ShortcutsDialog />
  </template>

  <ConfirmDialog />
  <Toast position="top-right" />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import ConfirmDialog from 'primevue/confirmdialog'
import Toast from 'primevue/toast'
import { Icon } from '@iconify/vue'
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
const noteListRef = ref(null)
const unsubscribers = []

onMounted(async () => {
  settings.init()
  updateCheck.init()
  // allinea la spunta dei radio "Vista > Toolbar" alla preferenza persistita
  api.syncToolbarMode(settings.toolbarMode)
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
    api.onMenu('menu:focus-search', () => noteListRef.value?.focusSearch()),
    api.onMenu('menu:toggle-sidebar', () => ui.toggleSidebar()),
    api.onMenu('menu:settings', () => ui.openSettings()),
    api.onMenu('menu:shortcuts', () => ui.openShortcuts()),
    api.onMenu('menu:toolbar-mode', (mode) => settings.setToolbarMode(mode))
  )
})

onBeforeUnmount(() => {
  unsubscribers.forEach((off) => off())
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
  -webkit-app-region: drag;
}
.spin {
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.app-shell {
  height: 100vh;
  border: none !important;
}

.panel {
  overflow: hidden;
}

.sidebar-panel {
  background: var(--sidebar-bg);
}

.p-splitter-gutter {
  background: var(--p-content-border-color) !important;
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
