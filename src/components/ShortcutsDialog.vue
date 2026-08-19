<template>
  <Dialog
    v-model:visible="ui.shortcutsOpen"
    modal
    header="Scorciatoie da tastiera"
    :style="{ width: '30rem' }"
    :draggable="false"
    dismissable-mask
  >
    <div v-for="group in groups" :key="group.title" class="shortcut-group">
      <div class="group-title">{{ group.title }}</div>
      <ul class="shortcut-list">
        <li v-for="s in group.items" :key="s.label">
          <span class="shortcut-label">{{ s.label }}</span>
          <span class="keys">
            <kbd v-for="(k, i) in s.keys" :key="i">{{ k }}</kbd>
          </span>
        </li>
      </ul>
    </div>
  </Dialog>
</template>

<script setup>
import Dialog from 'primevue/dialog'
import { useUiStore } from '../stores/ui'

const ui = useUiStore()

const isMac = navigator.platform.toLowerCase().includes('mac')
const mod = isMac ? '⌘' : 'Ctrl'
const alt = isMac ? '⌥' : 'Alt'
const shift = '⇧'

const groups = [
  {
    title: 'Generale',
    items: [
      { label: 'Nuova nota', keys: [mod, 'N'] },
      { label: 'Nuova cartella', keys: [mod, shift, 'N'] },
      { label: 'Duplica nota', keys: [mod, 'D'] },
      { label: 'Cerca nelle note', keys: [mod, 'F'] },
      { label: 'Mostra/Nascondi sidebar', keys: [mod, '/'] },
      { label: 'Impostazioni', keys: [mod, ','] }
    ]
  },
  {
    title: 'Formattazione (nell’editor)',
    items: [
      { label: 'Grassetto', keys: [mod, 'B'] },
      { label: 'Corsivo', keys: [mod, 'I'] },
      { label: 'Sottolineato', keys: [mod, 'U'] },
      { label: 'Barrato', keys: [mod, shift, 'X'] },
      { label: 'Codice inline', keys: [mod, 'E'] },
      { label: 'Titolo 1 / 2 / 3', keys: [mod, alt, '1·2·3'] },
      { label: 'Testo normale', keys: [mod, alt, '0'] },
      { label: 'Elenco numerato', keys: [mod, shift, '7'] },
      { label: 'Elenco puntato', keys: [mod, shift, '8'] },
      { label: 'Elenco di controllo', keys: [mod, shift, '9'] },
      { label: 'Citazione', keys: [mod, shift, 'B'] },
      { label: 'Blocco di codice', keys: [mod, shift, 'C'] },
      { label: 'Inserisci link', keys: [mod, 'K'] },
      { label: 'Annulla / Ripeti', keys: [mod, '(⇧) Z'] }
    ]
  }
]
</script>

<style scoped>
.shortcut-group {
  margin-bottom: 18px;
}
.shortcut-group:last-child {
  margin-bottom: 0;
}
.group-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color);
  margin-bottom: 4px;
}
.shortcut-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.shortcut-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 2px;
  border-bottom: 1px solid var(--p-content-border-color);
}
.shortcut-list li:last-child {
  border-bottom: none;
}
.shortcut-label {
  font-size: 13px;
  color: var(--p-text-color);
}
.keys {
  display: flex;
  gap: 4px;
}
kbd {
  min-width: 22px;
  text-align: center;
  padding: 2px 7px;
  font-family: inherit;
  font-size: 12px;
  color: var(--p-text-color);
  background: var(--search-bg);
  border: 1px solid var(--p-content-border-color);
  border-radius: 5px;
  box-shadow: 0 1px 0 var(--p-content-border-color);
}
</style>
