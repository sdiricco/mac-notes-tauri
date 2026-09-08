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
        :title="showingDetailOnNarrow ? 'Tutte le categorie' : 'Chiudi impostazioni'"
        data-tauri-drag-region="false"
        @click="back"
      >
        <Icon icon="lucide:arrow-left" />
      </button>
      <h1>{{ showingDetailOnNarrow ? current.label : 'Impostazioni' }}</h1>
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
        aria-label="Categorie impostazioni"
        @keydown="onNavKeydown"
      >
        <button
          v-for="(s, i) in SECTIONS"
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
            <section class="group">
              <div class="group-title">Elenco note</div>
              <div class="card">
                <div class="row">
                  <div class="row-text">
                    <span class="row-label">Ordinamento predefinito</span>
                    <span class="row-desc">Criterio con cui e' ordinato l'elenco delle note</span>
                  </div>
                  <select :value="settings.sortKey" class="settings-select" @change="settings.setSort($event.target.value)">
                    <option value="updated">Data modifica</option>
                    <option value="created">Data creazione</option>
                    <option value="title">Titolo</option>
                  </select>
                </div>
              </div>
            </section>
          </template>

          <!-- ===================== Aspetto ===================== -->
          <template v-else-if="current.id === 'appearance'">
            <section class="group">
              <div class="group-title">Tema</div>
              <div class="card">
                <div class="row row-stack">
                  <div class="segmented" role="radiogroup" aria-label="Tema">
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
              <p class="group-note">Con "Sistema" l'app segue l'aspetto chiaro o scuro di macOS.</p>
            </section>
          </template>

          <!-- ===================== Editor ===================== -->
          <template v-else-if="current.id === 'editor'">
            <section class="group">
              <div class="group-title">Correzione ortografica</div>
              <div class="card">
                <div class="row">
                  <div class="row-text">
                    <span id="spell-label" class="row-label">Correzione ortografica</span>
                    <span class="row-desc">Sottolinea le parole non riconosciute mentre scrivi</span>
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
                    <span class="row-label">Lingua</span>
                    <span class="row-desc">Dizionario usato per la correzione</span>
                  </div>
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
            <section class="group">
              <div class="group-title">Applicazione</div>
              <div class="card">
                <div class="row">
                  <span class="row-label">Versione</span>
                  <span class="row-value">{{ updateCheck.currentVersion || '—' }}</span>
                </div>
                <div class="row">
                  <div class="row-text">
                    <span class="row-label">Aggiornamenti</span>
                    <span class="row-desc">Confronta con l'ultima versione pubblicata</span>
                  </div>
                  <button class="action-btn" :disabled="updateCheck.checking" @click="onCheckUpdates">
                    <Icon
                      :icon="updateCheck.checking ? 'lucide:loader-circle' : 'lucide:refresh-cw'"
                      :class="{ spin: updateCheck.checking }"
                    />
                    <span>{{ updateCheck.checking ? 'Verifica…' : 'Controlla aggiornamenti' }}</span>
                  </button>
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
                  Versione {{ updateCheck.latestVersion }} disponibile — esegui
                  <code>brew upgrade --cask mac-notes-tauri</code>
                </span>
                <span v-else>Hai già la versione più recente</span>
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
import { useSettingsStore } from '../stores/settings'
import { useUiStore } from '../stores/ui'
import { useUpdateCheckStore } from '../stores/updateCheck'
import { ALT, MOD, SHIFT } from '../utils/shortcuts'

const settings = useSettingsStore()
const ui = useUiStore()
const updateCheck = useUpdateCheckStore()
const hasChecked = ref(false)

// Ordine = ordine in cui le si incontra: prima cio' che si tocca piu' spesso,
// per ultime le informazioni, che si consultano e non si impostano.
const SECTIONS = [
  { id: 'general', label: 'Generale', icon: 'lucide:sliders-horizontal' },
  { id: 'appearance', label: 'Aspetto', icon: 'lucide:palette' },
  { id: 'editor', label: 'Editor', icon: 'lucide:spell-check' },
  { id: 'shortcuts', label: 'Scorciatoie', icon: 'lucide:keyboard' },
  { id: 'about', label: 'Informazioni', icon: 'lucide:info' }
]

const current = computed(
  () => SECTIONS.find((s) => s.id === ui.settingsSection) || SECTIONS[0]
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
  const i = SECTIONS.findIndex((s) => s.id === ui.settingsSection)
  const n = SECTIONS.length
  const next = move === 'first' ? 0 : move === 'last' ? n - 1 : (i + move + n) % n
  ui.settingsSection = SECTIONS[next].id
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

const themeOptions = [
  { value: 'system', label: 'Sistema', icon: 'lucide:monitor' },
  { value: 'light', label: 'Chiaro', icon: 'lucide:sun' },
  { value: 'dark', label: 'Scuro', icon: 'lucide:moon' }
]

// Etichette da utils/shortcuts, le stesse dei tooltip della toolbar: una sola
// fonte, cosi' cambiare una combinazione aggiorna entrambe.
const shortcutGroups = [
  {
    title: 'Generale',
    items: [
      { label: 'Nuova nota', keys: [MOD, 'N'] },
      { label: 'Nuova cartella', keys: [MOD, SHIFT, 'N'] },
      { label: 'Duplica nota', keys: [MOD, 'D'] },
      { label: 'Cerca nella nota', keys: [MOD, 'F'] },
      { label: 'Cerca in tutte le note', keys: [MOD, SHIFT, 'F'] },
      { label: 'Mostra/Nascondi sidebar', keys: [MOD, '/'] },
      { label: 'Impostazioni', keys: [MOD, ','] }
    ]
  },
  {
    title: 'Formattazione (nell’editor)',
    items: [
      { label: 'Grassetto', keys: [MOD, 'B'] },
      { label: 'Corsivo', keys: [MOD, 'I'] },
      { label: 'Sottolineato', keys: [MOD, 'U'] },
      { label: 'Barrato', keys: [MOD, SHIFT, 'X'] },
      { label: 'Codice inline', keys: [MOD, 'E'] },
      { label: 'Titolo 1 / 2 / 3', keys: [MOD, ALT, '1·2·3'] },
      { label: 'Testo normale', keys: [MOD, ALT, '0'] },
      { label: 'Elenco numerato', keys: [MOD, SHIFT, '7'] },
      { label: 'Elenco puntato', keys: [MOD, SHIFT, '8'] },
      { label: 'Elenco di controllo', keys: [MOD, SHIFT, '9'] },
      { label: 'Citazione', keys: [MOD, SHIFT, 'B'] },
      { label: 'Blocco di codice', keys: [MOD, SHIFT, 'C'] },
      { label: 'Inserisci link', keys: [MOD, 'K'] },
      { label: 'Annulla / Ripeti', keys: [MOD, '(⇧) Z'] }
    ]
  }
]

async function onCheckUpdates() {
  await updateCheck.check()
  hasChecked.value = true
}
</script>

<style scoped>
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
.settings-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  padding: 0 12px 0 74px;
  border-bottom: 1px solid var(--p-content-border-color);
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
  padding: 4px;
  border-radius: 6px;
  font-size: 15px;
  display: flex;
  align-items: center;
  outline: none;
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
.row-stack {
  display: block;
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

.settings-select {
  flex-shrink: 0;
  background: var(--search-bg);
  border: 1px solid var(--p-content-border-color);
  border-radius: 7px;
  padding: 5px 8px;
  color: var(--p-text-color);
  font-family: inherit;
  font-size: 13px;
  outline: none;
}
.settings-select:disabled {
  opacity: 0.45;
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

.action-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--p-content-border-color);
  background: transparent;
  color: var(--p-text-color);
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 7px;
}
.action-btn:hover {
  background: var(--sidebar-hover-bg);
}
.action-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.action-btn :deep(svg) {
  font-size: 13px;
}
.action-btn :deep(svg.spin) {
  animation: settings-spin 1s linear infinite;
}
@keyframes settings-spin {
  to {
    transform: rotate(360deg);
  }
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
.action-btn:focus-visible,
.settings-select:focus-visible,
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
