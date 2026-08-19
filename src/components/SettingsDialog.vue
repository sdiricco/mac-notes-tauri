<template>
  <Dialog
    v-model:visible="ui.settingsOpen"
    modal
    header="Impostazioni"
    :style="{ width: '30rem' }"
    :draggable="false"
    dismissable-mask
  >
    <div class="settings-section">
      <div class="settings-label">Aspetto</div>
      <div class="segmented">
        <button
          v-for="opt in themeOptions"
          :key="opt.value"
          class="segment"
          :class="{ active: settings.theme === opt.value }"
          @click="settings.setTheme(opt.value)"
        >
          <Icon :icon="opt.icon" />
          <span>{{ opt.label }}</span>
        </button>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-label">Ordinamento predefinito</div>
      <div class="settings-row">
        <span class="settings-desc">Nota selezionata come criterio in elenco</span>
        <select :value="settings.sortKey" class="settings-select" @change="settings.setSort($event.target.value)">
          <option value="updated">Data modifica</option>
          <option value="created">Data creazione</option>
          <option value="title">Titolo</option>
        </select>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-label">Correzione ortografica</div>
      <div class="settings-row">
        <label class="settings-desc">
          <input type="checkbox" :checked="settings.spellcheck" @change="settings.toggleSpellcheck()" />
          Abilita
        </label>
        <select
          :value="settings.spellLang"
          class="settings-select"
          :disabled="!settings.spellcheck"
          @change="settings.setSpellLang($event.target.value)"
        >
          <option value="it">Italiano</option>
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
        </select>
      </div>
    </div>

    <div class="settings-section">
      <button class="link-btn" @click="openShortcuts">
        <Icon icon="lucide:keyboard" />
        <span>Scorciatoie da tastiera</span>
      </button>
    </div>

    <div class="settings-section">
      <div class="settings-label">Informazioni</div>
      <div class="settings-row">
        <span class="settings-desc">Versione {{ updateCheck.currentVersion || '—' }}</span>
        <button class="check-update-btn" :disabled="updateCheck.checking" @click="onCheckUpdates">
          <Icon :icon="updateCheck.checking ? 'lucide:loader-circle' : 'lucide:refresh-cw'" :class="{ spin: updateCheck.checking }" />
          <span>{{ updateCheck.checking ? 'Verifica…' : 'Controlla aggiornamenti' }}</span>
        </button>
      </div>
      <div v-if="hasChecked && !updateCheck.checking" class="update-status" :class="{ available: updateCheck.available }">
        <Icon :icon="updateCheck.available ? 'lucide:arrow-up-circle' : 'lucide:check-circle'" />
        <span v-if="updateCheck.available">
          Versione {{ updateCheck.latestVersion }} disponibile — esegui <code>brew upgrade --cask mac-notes</code>
        </span>
        <span v-else>Hai già la versione più recente</span>
      </div>
    </div>
  </Dialog>
</template>

<script setup>
import { ref } from 'vue'
import Dialog from 'primevue/dialog'
import { Icon } from '@iconify/vue'
import { useSettingsStore } from '../stores/settings'
import { useUiStore } from '../stores/ui'
import { useUpdateCheckStore } from '../stores/updateCheck'

const settings = useSettingsStore()
const ui = useUiStore()
const updateCheck = useUpdateCheckStore()
const hasChecked = ref(false)

const themeOptions = [
  { value: 'system', label: 'Sistema', icon: 'lucide:monitor' },
  { value: 'light', label: 'Chiaro', icon: 'lucide:sun' },
  { value: 'dark', label: 'Scuro', icon: 'lucide:moon' }
]

function openShortcuts() {
  ui.settingsOpen = false
  ui.openShortcuts()
}

async function onCheckUpdates() {
  await updateCheck.check()
  hasChecked.value = true
}
</script>

<style scoped>
.settings-section {
  margin-bottom: 20px;
}
.settings-section:last-child {
  margin-bottom: 0;
}

.settings-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color);
  margin-bottom: 8px;
}

.segmented {
  display: flex;
  gap: 6px;
}
.segment {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  background: transparent;
  color: var(--p-text-color);
  cursor: pointer;
  font-size: 13px;
}
.segment :deep(svg) {
  font-size: 20px;
}
.segment:hover {
  background: var(--sidebar-hover-bg);
}
.segment.active {
  border-color: var(--p-text-color);
  background: var(--selection-bg);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.settings-desc {
  font-size: 13px;
  color: var(--p-text-color);
  display: flex;
  align-items: center;
  gap: 7px;
}
.settings-desc input[type='checkbox'] {
  accent-color: var(--p-text-color);
}
.settings-select:disabled {
  opacity: 0.45;
}
.settings-select {
  background: var(--search-bg);
  border: 1px solid var(--p-content-border-color);
  border-radius: 7px;
  padding: 5px 8px;
  color: var(--p-text-color);
  font-size: 13px;
  outline: none;
}

.link-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  color: var(--p-text-color);
  cursor: pointer;
  font-size: 13px;
  padding: 6px 10px;
  margin: 0 -10px;
  border-radius: 7px;
}
.link-btn :deep(svg) {
  font-size: 17px;
  color: var(--icon-color);
}
.link-btn:hover {
  background: var(--sidebar-hover-bg);
}

.check-update-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--p-content-border-color);
  background: transparent;
  color: var(--p-text-color);
  cursor: pointer;
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 7px;
}
.check-update-btn:hover {
  background: var(--sidebar-hover-bg);
}
.check-update-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.check-update-btn :deep(svg) {
  font-size: 13px;
}

.update-status {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 7px;
  background: var(--search-bg);
  color: var(--p-text-muted-color);
  font-size: 12px;
  line-height: 1.5;
}
.update-status.available {
  color: var(--p-text-color);
}
.update-status :deep(svg) {
  flex-shrink: 0;
  font-size: 15px;
}
.update-status.available :deep(svg) {
  color: #3b82f6;
}
.update-status code {
  background: var(--editor-bg);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 11px;
}
.check-update-btn :deep(svg.spin) {
  animation: settings-spin 1s linear infinite;
}
@keyframes settings-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
