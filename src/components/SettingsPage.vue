<template>
  <!-- Pagina e non modale: copre tutta la finestra, con la sua banda in cima
       e la freccia per tornare indietro. position: fixed e non uno scambio di
       v-if in App.vue, cosi' l'editor resta montato sotto: rimontarlo vuol
       dire ricostruire Quill, perdendo cronologia dell'annulla e posizione di
       scorrimento.
       Layout a due colonne come le Impostazioni di Sistema: categorie a
       sinistra, contenuto della categoria a destra. A finestra stretta le due
       colonne diventano un master-detail: prima l'elenco, poi il dettaglio. -->
  <div v-if="ui.settingsOpen" class="settings-page" :class="{ 'is-narrow': ui.narrow }">
    <div class="settings-topbar" data-tauri-drag-region="deep">
      <button
        class="icon-btn"
        :title="showingDetailOnNarrow ? t('settings.allCategories') : t('settings.close')"
        data-tauri-drag-region="false"
        @click="back"
      >
        <Icon icon="lucide:arrow-left" />
      </button>
      <h1>{{ showingDetailOnNarrow ? current.label : t('settings.title') }}</h1>
    </div>

    <div class="settings-layout">
      <!-- role=tablist: le categorie sono schede, non link. Frecce su/giu'
           spostano la selezione (tabindex mobile: una sola voce nel giro del
           Tab, le altre si raggiungono con le frecce, come nei tab nativi). -->
      <nav
        v-show="!ui.narrow || !detailOpen"
        class="settings-nav"
        role="tablist"
        aria-orientation="vertical"
        :aria-label="t('settings.categoriesAria')"
        @keydown="onNavKeydown"
      >
        <button
          v-for="(s, i) in sections"
          :key="s.id"
          :ref="(el) => (navEls[i] = el)"
          class="nav-item"
          :class="{ active: s.id === ui.settingsSection }"
          role="tab"
          :aria-selected="s.id === ui.settingsSection"
          :aria-controls="`settings-panel-${s.id}`"
          :tabindex="s.id === ui.settingsSection ? 0 : -1"
          @click="select(s.id)"
        >
          <span class="nav-icon"><Icon :icon="s.icon" /></span>
          <span class="nav-label">{{ s.label }}</span>
          <Icon v-if="ui.narrow" icon="lucide:chevron-right" class="nav-chevron" />
        </button>
      </nav>

      <div
        v-show="!ui.narrow || detailOpen"
        :id="`settings-panel-${current.id}`"
        class="settings-content"
        role="tabpanel"
      >
        <div class="settings-col">
          <!-- Il titolo ripete la categoria: a finestra larga la voce attiva e'
               a sinistra, ma lo sguardo sta qui. -->
          <h2 v-if="!ui.narrow">{{ current.label }}</h2>

          <!-- ===================== Generale ===================== -->
          <template v-if="current.id === 'general'">
            <!-- Lingua dell'interfaccia: una tendina e non il controllo
                 segmentato del tema, perche' con otto lingue i segmenti non
                 starebbero nella larghezza della scheda. -->
            <section class="group">
              <div class="group-title">{{ t('settings.general.language.title') }}</div>
              <div class="card">
                <div class="row">
                  <div class="row-text">
                    <span class="row-label">{{ t('settings.general.language.title') }}</span>
                    <span class="row-desc">{{ t('settings.general.language.note') }}</span>
                  </div>
                  <Select
                    :model-value="settings.language"
                    :options="languageOptions"
                    option-label="label"
                    option-value="value"
                    size="small"
                    class="settings-select"
                    :aria-label="t('settings.general.language.aria')"
                    @update:model-value="settings.setLanguage($event)"
                  />
                </div>
              </div>
            </section>

            <section class="group">
              <div class="group-title">{{ t('settings.general.list.title') }}</div>
              <div class="card">
                <div class="row">
                  <div class="row-text">
                    <span class="row-label">{{ t('settings.general.list.sortLabel') }}</span>
                    <span class="row-desc">{{ t('settings.general.list.sortDesc') }}</span>
                  </div>
                  <Select
                    :model-value="settings.sortKey"
                    :options="sortOptions"
                    option-label="label"
                    option-value="value"
                    size="small"
                    class="settings-select"
                    @update:model-value="settings.setSort($event)"
                  />
                </div>
              </div>
            </section>
          </template>

          <!-- ===================== Aspetto ===================== -->
          <template v-else-if="current.id === 'appearance'">
            <section class="group">
              <div class="group-title">{{ t('settings.appearance.theme.title') }}</div>
              <div class="card">
                <div class="row row-stack">
                  <div class="segmented" role="radiogroup" :aria-label="t('settings.appearance.theme.aria')">
                    <button
                      v-for="opt in themeOptions"
                      :key="opt.value"
                      class="segment"
                      :class="{ active: settings.theme === opt.value }"
                      role="radio"
                      :aria-checked="settings.theme === opt.value"
                      @click="settings.setTheme(opt.value)"
                    >
                      <Icon :icon="opt.icon" />
                      <span>{{ opt.label }}</span>
                    </button>
                  </div>
                </div>
              </div>
              <p class="group-note">{{ t('settings.appearance.theme.note') }}</p>
            </section>
          </template>

          <!-- ===================== Editor ===================== -->
          <template v-else-if="current.id === 'editor'">
            <section class="group">
              <div class="group-title">{{ t('settings.editor.spell.title') }}</div>
              <div class="card">
                <div class="row">
                  <div class="row-text">
                    <span id="spell-label" class="row-label">{{ t('settings.editor.spell.label') }}</span>
                    <span class="row-desc">{{ t('settings.editor.spell.desc') }}</span>
                  </div>
                  <button
                    class="switch"
                    role="switch"
                    :aria-checked="settings.spellcheck"
                    aria-labelledby="spell-label"
                    @click="settings.toggleSpellcheck()"
                  >
                    <span class="switch-thumb"></span>
                  </button>
                </div>
                <div class="row" :class="{ 'is-disabled': !settings.spellcheck }">
                  <div class="row-text">
                    <span class="row-label">{{ t('settings.editor.spell.langLabel') }}</span>
                    <span class="row-desc">{{ t('settings.editor.spell.langDesc') }}</span>
                  </div>
                  <Select
                    :model-value="settings.spellLang"
                    :options="spellLangOptions"
                    option-label="label"
                    option-value="value"
                    size="small"
                    class="settings-select"
                    :disabled="!settings.spellcheck"
                    @update:model-value="settings.setSpellLang($event)"
                  />
                </div>
              </div>
            </section>
          </template>

          <!-- ===================== Scorciatoie ===================== -->
          <template v-else-if="current.id === 'shortcuts'">
            <section v-for="group in shortcutGroups" :key="group.title" class="group">
              <div class="group-title">{{ group.title }}</div>
              <div class="card">
                <div v-for="s in group.items" :key="s.label" class="row row-compact">
                  <span class="row-label">{{ s.label }}</span>
                  <span class="keys">
                    <kbd v-for="(k, i) in s.keys" :key="i">{{ k }}</kbd>
                  </span>
                </div>
              </div>
            </section>
          </template>

          <!-- ===================== Informazioni ===================== -->
          <template v-else-if="current.id === 'about'">
            <!-- Dove vivono le note. Puntare una cartella sincronizzata
                 (iCloud, Dropbox, Syncthing) e' il modo in cui l'app offre il
                 sync senza account ne' server. -->
            <section class="group">
              <div class="group-title">{{ t('settings.data.title') }}</div>
              <div class="card">
                <div class="row row-stack">
                  <div class="row-text">
                    <span class="row-label">
                      {{ t('settings.data.folderLabel') }}
                      <span v-if="dataDir.isDefault" class="badge">{{ t('settings.data.defaultBadge') }}</span>
                    </span>
                    <span class="row-desc">{{ t('settings.data.folderDesc') }}</span>
                  </div>
                  <code class="data-path" :title="dataDir.dir">{{ dataDir.dir || '—' }}</code>
                  <div class="btn-row">
                    <Button
                      :label="t('settings.data.change')"
                      severity="secondary"
                      outlined
                      size="small"
                      :loading="changingDir"
                      @click="onChangeDataDir"
                    >
                      <template #icon><Icon icon="lucide:folder-input" /></template>
                    </Button>
                    <Button
                      v-if="!dataDir.isDefault"
                      :label="t('settings.data.reset')"
                      severity="secondary"
                      outlined
                      size="small"
                      :disabled="changingDir"
                      @click="onResetDataDir"
                    >
                      <template #icon><Icon icon="lucide:undo-2" /></template>
                    </Button>
                    <Button
                      :label="t('settings.data.reveal', isMac ? 1 : 2)"
                      severity="secondary"
                      outlined
                      size="small"
                      @click="api.revealDataFile()"
                    >
                      <template #icon><Icon icon="lucide:folder-open" /></template>
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <section class="group">
              <div class="group-title">{{ t('settings.about.title') }}</div>
              <div class="card">
                <div class="row">
                  <span class="row-label">{{ t('settings.about.version') }}</span>
                  <span class="row-value">{{ updateCheck.currentVersion || '—' }}</span>
                </div>
                <!-- I dati sono dell'utente: una via d'uscita completa, non
                     solo l'export nota per nota dall'editor. -->
                <div class="row">
                  <div class="row-text">
                    <span class="row-label">{{ t('settings.about.exportAll') }}</span>
                    <span class="row-desc">{{ t('settings.about.exportAllDesc') }}</span>
                  </div>
                  <Button
                    :label="t('settings.about.exportAllButton')"
                    severity="secondary"
                    outlined
                    size="small"
                    :loading="exporting"
                    @click="onExportAll"
                  >
                    <template #icon><Icon icon="lucide:folder-output" /></template>
                  </Button>
                </div>
                <div class="row">
                  <div class="row-text">
                    <span class="row-label">{{ t('settings.about.updates') }}</span>
                    <span class="row-desc">{{ t('settings.about.updatesDesc') }}</span>
                  </div>
                  <Button
                    :label="updateCheck.checking ? t('settings.about.checking') : t('settings.about.checkUpdates')"
                    severity="secondary"
                    outlined
                    size="small"
                    :loading="updateCheck.checking"
                    @click="onCheckUpdates"
                  >
                    <template #icon><Icon icon="lucide:refresh-cw" /></template>
                  </Button>
                </div>
              </div>
              <div
                v-if="hasChecked && !updateCheck.checking"
                class="update-status"
                :class="{ available: updateCheck.available }"
                role="status"
              >
                <Icon :icon="updateCheck.available ? 'lucide:arrow-up-circle' : 'lucide:check-circle'" />
                <span v-if="updateCheck.available">
                  {{ t('settings.about.available', { version: updateCheck.latestVersion }) }}
                  <code>brew upgrade --cask mac-notes-tauri</code>
                </span>
                <span v-else>{{ t('settings.about.upToDate') }}</span>
              </div>
            </section>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settings'
import { useUiStore } from '../stores/ui'
import { useUpdateCheckStore } from '../stores/updateCheck'
import { useNotesStore } from '../stores/notes'
import { useToast } from 'primevue/usetoast'
import { ALT, MOD, SHIFT, isMac } from '../utils/shortcuts'
import { exportAllNotes } from '../utils/exportAll'
import { api } from '../utils/api'
import { useConfirm } from 'primevue/useconfirm'
import { LOCALES } from '../i18n'

const { t } = useI18n()
const settings = useSettingsStore()
const ui = useUiStore()
const updateCheck = useUpdateCheckStore()
const notes = useNotesStore()
const toast = useToast()
const confirm = useConfirm()
const hasChecked = ref(false)
const exporting = ref(false)

// Cartella dati: letta da Rust all'apertura della pagina, non dallo store
// settings (che vive in localStorage della webview): e' Rust che la decide,
// perche' deve conoscerla prima che la webview esista.
const dataDir = ref({ dir: '', isDefault: true })
const changingDir = ref(false)

async function refreshDataDir() {
  try {
    dataDir.value = await api.getDataDirInfo()
  } catch {
    // fuori da Tauri (test, anteprima) resta il placeholder
  }
}
onMounted(refreshDataDir)

// Prima di cambiare cartella si guarda cosa contiene: se ha gia' un archivio
// RustNotes si adottano quelle note (caso "secondo computer sulla stessa
// cartella sincronizzata"), altrimenti si spostano le correnti. In entrambi
// i casi l'utente conferma sapendo cosa succedera'.
function askDataDirConfirm(target, inspection) {
  const count = inspection.hasData ? inspection.noteCount : notes.notes.length
  const adopt = inspection.hasData
  return new Promise((resolve) => {
    confirm.require({
      header: adopt ? t('settings.data.confirmAdoptTitle') : t('settings.data.confirmMoveTitle'),
      message: adopt
        ? t('settings.data.confirmAdopt', { dir: target, count }, count)
        : t('settings.data.confirmMove', { dir: target, count }, count),
      acceptLabel: t('settings.data.confirm'),
      rejectLabel: t('settings.data.cancel'),
      accept: () => resolve(true),
      reject: () => resolve(false),
      onHide: () => resolve(false)
    })
  })
}

async function applyDataDir(target) {
  changingDir.value = true
  try {
    const result = await api.setDataDir(target)
    if (result.mode !== 'unchanged') {
      // L'archivio in uso e' un altro: lo store va ricaricato da zero.
      await notes.init()
      toast.add({
        severity: 'success',
        summary: result.mode === 'adopted' ? t('settings.data.adoptedToast') : t('settings.data.movedToast'),
        detail: t('settings.data.toastDetail', { dir: result.dir }),
        life: 5000
      })
    }
    await refreshDataDir()
  } catch (err) {
    toast.add({ severity: 'error', summary: t('settings.data.failedToast'), detail: String(err), life: 6000 })
  } finally {
    changingDir.value = false
  }
}

async function onChangeDataDir() {
  const picked = await api.pickFolder()
  if (!picked || picked === dataDir.value.dir) return
  const inspection = await api.inspectDir(picked)
  if (await askDataDirConfirm(picked, inspection)) await applyDataDir(picked)
}

async function onResetDataDir() {
  // La predefinita non e' nota qui: si chiede a Rust ispezionando "null"
  // dopo, ma per la conferma basta sapere che ci si sta tornando. Se la
  // predefinita contiene gia' note (raro: qualcuno ci ha scritto a mano)
  // Rust le adotta, e il toast lo dice.
  const target = null
  if (await askDataDirConfirm(t('settings.data.defaultBadge'), { hasData: false, noteCount: 0 })) {
    await applyDataDir(target)
  }
}

// Ordine = ordine in cui le si incontra: prima cio' che si tocca piu' spesso,
// per ultime le informazioni, che si consultano e non si impostano.
// Computed e non costante: le etichette seguono la lingua corrente.
const sections = computed(() => [
  { id: 'general', label: t('settings.sections.general'), icon: 'lucide:sliders-horizontal' },
  { id: 'appearance', label: t('settings.sections.appearance'), icon: 'lucide:palette' },
  { id: 'editor', label: t('settings.sections.editor'), icon: 'lucide:spell-check' },
  { id: 'shortcuts', label: t('settings.sections.shortcuts'), icon: 'lucide:keyboard' },
  { id: 'about', label: t('settings.sections.about'), icon: 'lucide:info' }
])

const current = computed(
  () => sections.value.find((s) => s.id === ui.settingsSection) || sections.value[0]
)

// Master-detail a finestra stretta: false = elenco categorie, true = una
// categoria. A finestra larga e' irrilevante, si vedono entrambi.
const detailOpen = ref(false)
const showingDetailOnNarrow = computed(() => ui.narrow && detailOpen.value)

// All'apertura si atterra sul dettaglio solo se e' stato chiesto (voce di
// menu "Scorciatoie"), altrimenti sull'elenco, che e' la pagina "casa".
watch(
  () => ui.settingsOpen,
  (open) => {
    if (open) detailOpen.value = ui.settingsSectionRequested
  }
)

const navEls = ref([])

function select(id) {
  ui.settingsSection = id
  detailOpen.value = true
}

// Frecce su/giu' fra le categorie, Home/End agli estremi: pattern dei tab
// verticali. La selezione segue il focus, non serve Invio.
async function onNavKeydown(event) {
  const keys = { ArrowDown: 1, ArrowUp: -1, Home: 'first', End: 'last' }
  const move = keys[event.key]
  if (move === undefined) return
  event.preventDefault()
  const i = sections.value.findIndex((s) => s.id === ui.settingsSection)
  const n = sections.value.length
  const next = move === 'first' ? 0 : move === 'last' ? n - 1 : (i + move + n) % n
  ui.settingsSection = sections.value[next].id
  await nextTick()
  navEls.value[next]?.focus()
}

// A finestra stretta la freccia torna prima all'elenco e solo poi chiude;
// a finestra larga chiude subito.
function back() {
  if (showingDetailOnNarrow.value) detailOpen.value = false
  else ui.closeSettings()
}

// Esc si comporta come la freccia.
function onKeydown(event) {
  if (event.key === 'Escape' && ui.settingsOpen) back()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

const themeOptions = computed(() => [
  { value: 'system', label: t('settings.appearance.theme.system'), icon: 'lucide:monitor' },
  { value: 'light', label: t('settings.appearance.theme.light'), icon: 'lucide:sun' },
  { value: 'dark', label: t('settings.appearance.theme.dark'), icon: 'lucide:moon' }
])


// Opzioni delle tendine: computed perche' le etichette seguono la lingua.
// 'system' segue il sistema operativo (vedi resolveLocale in i18n); i nomi
// delle lingue sono nativi e vengono da LOCALES.
const languageOptions = computed(() => [
  { value: 'system', label: t('settings.general.language.system') },
  ...LOCALES.map((l) => ({ value: l.code, label: l.name }))
])
const sortOptions = computed(() => [
  { value: 'updated', label: t('settings.general.list.sortUpdated') },
  { value: 'created', label: t('settings.general.list.sortCreated') },
  { value: 'title', label: t('settings.general.list.sortTitle') }
])
const spellLangOptions = computed(() =>
  ['it', 'en', 'es', 'fr', 'de'].map((code) => ({
    value: code,
    label: t(`settings.editor.spell.lang${code[0].toUpperCase()}${code[1]}`)
  }))
)

// Etichette da utils/shortcuts, le stesse dei tooltip della toolbar: una sola
// fonte, cosi' cambiare una combinazione aggiorna entrambe.
const shortcutGroups = computed(() => [
  {
    title: t('settings.shortcuts.general.title'),
    items: [
      { label: t('settings.shortcuts.general.newNote'), keys: [MOD, 'N'] },
      { label: t('settings.shortcuts.general.newFolder'), keys: [MOD, SHIFT, 'N'] },
      { label: t('settings.shortcuts.general.duplicateNote'), keys: [MOD, 'D'] },
      { label: t('settings.shortcuts.general.findInNote'), keys: [MOD, 'F'] },
      { label: t('settings.shortcuts.general.findInAllNotes'), keys: [MOD, SHIFT, 'F'] },
      { label: t('settings.shortcuts.general.toggleSidebar'), keys: [MOD, '/'] },
      { label: t('settings.shortcuts.general.settings'), keys: [MOD, ','] },
      { label: t('settings.shortcuts.general.zoomIn'), keys: [MOD, '+'] },
      { label: t('settings.shortcuts.general.zoomOut'), keys: [MOD, '-'] },
      { label: t('settings.shortcuts.general.zoomReset'), keys: [MOD, '0'] }
    ]
  },
  {
    title: t('settings.shortcuts.formatting.title'),
    items: [
      { label: t('settings.shortcuts.formatting.bold'), keys: [MOD, 'B'] },
      { label: t('settings.shortcuts.formatting.italic'), keys: [MOD, 'I'] },
      { label: t('settings.shortcuts.formatting.underline'), keys: [MOD, 'U'] },
      { label: t('settings.shortcuts.formatting.strike'), keys: [MOD, SHIFT, 'X'] },
      { label: t('settings.shortcuts.formatting.inlineCode'), keys: [MOD, 'E'] },
      { label: t('settings.shortcuts.formatting.headings'), keys: [MOD, ALT, '1·2·3'] },
      { label: t('settings.shortcuts.formatting.normalText'), keys: [MOD, ALT, '0'] },
      { label: t('settings.shortcuts.formatting.orderedList'), keys: [MOD, SHIFT, '7'] },
      { label: t('settings.shortcuts.formatting.bulletList'), keys: [MOD, SHIFT, '8'] },
      { label: t('settings.shortcuts.formatting.checklist'), keys: [MOD, SHIFT, '9'] },
      { label: t('settings.shortcuts.formatting.quote'), keys: [MOD, SHIFT, 'B'] },
      { label: t('settings.shortcuts.formatting.codeBlock'), keys: [MOD, SHIFT, 'C'] },
      { label: t('settings.shortcuts.formatting.insertLink'), keys: [MOD, 'K'] },
      { label: t('settings.shortcuts.formatting.undoRedo'), keys: [MOD, '(⇧) Z'] }
    ]
  }
])

async function onCheckUpdates() {
  await updateCheck.check()
  hasChecked.value = true
}

async function onExportAll() {
  exporting.value = true
  try {
    const result = await exportAllNotes(notes.notes, notes.folders)
    if (result && result.count === 0) {
      toast.add({ severity: 'info', summary: t('app.exportAll.nothing'), life: 3000 })
    } else if (result) {
      toast.add({
        severity: 'success',
        summary: t('app.exportAll.done'),
        detail: t('app.exportAll.doneDetail', { count: result.count, dir: result.dir }, result.count),
        life: 5000
      })
    }
    // result null: dialogo annullato, nessun messaggio
  } catch (err) {
    toast.add({ severity: 'error', summary: t('app.exportAll.failed'), detail: String(err), life: 5000 })
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.data-path {
  display: block;
  font-size: 12px;
  color: var(--p-text-muted-color);
  background: var(--sidebar-hover-bg);
  border-radius: 6px;
  padding: 6px 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  direction: rtl; /* si tronca a sinistra: la parte finale del percorso e' quella che distingue */
  text-align: left;
}
.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.data-path {
  margin: 0;
}
.badge {
  margin-left: 6px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--p-text-muted-color);
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  padding: 1px 5px;
  vertical-align: middle;
}

.settings-page {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  background: var(--editor-bg);
}

/* Stessa banda alta 40px delle altre viste, con lo stesso rientro a sinistra:
   i tre tasti finestra sono disegnati sopra la webview e cadrebbero sulla
   freccia. */
/* Stesse misure della banda del pannello (.note-list-topbar in NoteList,
   .sidebar-topbar in Sidebar): altezza 40, rientro 74 per i semafori, freccia
   con 8px di margine e glifo da 16px. La freccia indietro delle impostazioni
   cade cosi' esattamente sopra quella del pannello, e aprendo le
   impostazioni non "salta". Sfondo --sidebar-bg come l'header dell'editor. */
.settings-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px 0 74px;
  background: var(--sidebar-bg);
  border-bottom: 1px solid var(--p-content-border-color);
}
.settings-topbar .icon-btn {
  margin-left: 8px;
  font-size: 16px;
}
.settings-topbar h1 {
  margin: 0;
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
  font-size: 15px;
  display: flex;
  align-items: center;
  outline: none;
  flex-shrink: 0;
}
.icon-btn:hover {
  background: var(--sidebar-hover-bg);
  color: var(--p-text-color);
}

.settings-layout {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* ---- colonna categorie ---- */
.settings-nav {
  width: 220px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 10px 8px;
  background: var(--list-bg);
  border-right: 1px solid var(--p-content-border-color);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--p-text-color);
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.nav-item:hover {
  background: var(--sidebar-hover-bg);
}
.nav-item.active {
  background: var(--selection-bg);
  font-weight: 600;
}
/* Riquadro dietro l'icona, come nelle Impostazioni di Sistema: da' alle voci
   un peso uniforme anche con glifi di forma diversa. */
.nav-icon {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  background: var(--search-bg);
  color: var(--icon-color);
  font-size: 14px;
}
.nav-item.active .nav-icon {
  color: var(--p-text-color);
}
.nav-label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-chevron {
  flex-shrink: 0;
  color: var(--p-text-muted-color);
  font-size: 15px;
}

/* ---- contenuto ---- */
.settings-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 20px 28px 40px;
}
/* Colonna centrata e non a tutta larghezza: le righe etichetta/controllo
   avrebbero i due estremi lontanissimi e illeggibili. */
.settings-col {
  max-width: 640px;
  margin: 0 auto;
}
.settings-col h2 {
  margin: 2px 0 18px;
  font-size: 20px;
  font-weight: 700;
  color: var(--p-text-color);
}

.group {
  margin-bottom: 26px;
}
.group:last-child {
  margin-bottom: 0;
}
.group-title {
  margin: 0 0 6px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--p-text-muted-color);
}
/* Testo di aiuto sotto la scheda: spiega, non comanda. */
.group-note {
  margin: 8px 12px 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--p-text-muted-color);
}

/* Scheda "inset grouped": righe separate da un filo, una per impostazione,
   etichetta a sinistra e controllo a destra. */
.card {
  background: var(--card-bg);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  overflow: hidden;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 46px;
  padding: 10px 14px;
}
.row + .row {
  border-top: 1px solid var(--p-content-border-color);
}
.row-compact {
  min-height: 38px;
  padding: 7px 14px;
}
/* Riga "impilata" (card Dati): etichetta, percorso e pulsanti uno sotto
   l'altro, con un respiro fra i tre blocchi. */
.row-stack {
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 14px;
}

/* PrimeVue Select e Button (Aura) ridotti alla scala della pagina: la
   dimensione "small" di Aura resta piu' grande dei controlli custom
   accanto (interruttore, righe da 46px), quindi si ricalibrano font e
   padding senza toccare il tema globale. */
.settings-select {
  flex-shrink: 0;
  min-width: 160px;
  font-size: 13px;
}
.settings-select :deep(.p-select-label) {
  padding: 5px 8px;
  font-size: 13px;
}
.settings-select :deep(.p-select-dropdown) {
  width: 28px;
}
.card :deep(.p-button-sm) {
  font-size: 12px;
  padding: 5px 10px;
  gap: 6px;
  flex-shrink: 0;
}
.card :deep(.p-button-sm svg) {
  font-size: 13px;
}
.row.is-disabled .row-text {
  opacity: 0.45;
}
.row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.row-label {
  font-size: 13px;
  color: var(--p-text-color);
}
.row-desc {
  font-size: 12px;
  line-height: 1.4;
  color: var(--p-text-muted-color);
}
.row-value {
  font-size: 13px;
  color: var(--p-text-muted-color);
  font-variant-numeric: tabular-nums;
}

/* ---- controlli ---- */
.segmented {
  display: flex;
  gap: 8px;
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
  font-family: inherit;
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


/* Interruttore per un'impostazione si/no: piu' leggibile di una casella,
   e lo stato si vede dal colore prima ancora che dal segno. */
.switch {
  flex-shrink: 0;
  position: relative;
  width: 38px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 11px;
  background: var(--p-content-border-color);
  cursor: pointer;
  transition: background 0.15s;
}
.switch[aria-checked='true'] {
  background: var(--p-text-color);
}
.switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--card-bg);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s;
}
.switch[aria-checked='true'] .switch-thumb {
  transform: translateX(16px);
}


.keys {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
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

.update-status {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 10px 12px 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--p-text-muted-color);
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
  background: var(--search-bg);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 11px;
}

/* Anello di focus solo da tastiera, uguale su tutti i controlli. */
.nav-item:focus-visible,
.segment:focus-visible,
.switch:focus-visible,
.icon-btn:focus-visible {
  outline: 2px solid var(--p-text-color);
  outline-offset: 2px;
}

/* ---- finestra stretta: master-detail ---- */
.is-narrow .settings-nav {
  width: 100%;
  border-right: none;
  background: var(--editor-bg);
  padding: 8px 12px;
}
.is-narrow .nav-item {
  padding: 10px 10px;
  min-height: 46px;
}
.is-narrow .settings-content {
  padding: 12px 16px 32px;
}
</style>
