<template>
  <div class="quill-editor">
    <div ref="editorEl"></div>

    <!-- Cerca nella nota (Cmd+F): evidenzia i risultati con un formato Quill
         dedicato (vedi SearchHighlightBlot) invece di un overlay posizionato
         a mano, così segue automaticamente scroll/reflow del testo. -->
    <div v-if="findBar.visible" class="find-bar">
      <Icon icon="lucide:search" />
      <input
        ref="findInputEl"
        v-model="findBar.query"
        type="text"
        placeholder="Cerca nella nota..."
        @keydown.enter.exact.prevent="nextMatch"
        @keydown.enter.shift.prevent="prevMatch"
        @keydown.esc="closeFindBar"
      />
      <span class="find-bar-count">{{ findBarCountLabel }}</span>
      <button type="button" title="Precedente" :disabled="!findBar.matches.length" @click="prevMatch">
        <Icon icon="lucide:chevron-up" />
      </button>
      <button type="button" title="Successivo" :disabled="!findBar.matches.length" @click="nextMatch">
        <Icon icon="lucide:chevron-down" />
      </button>
      <button type="button" title="Chiudi" @click="closeFindBar">
        <Icon icon="lucide:x" />
      </button>
    </div>

    <div
      v-if="tableMenu.visible"
      ref="tableMenuEl"
      class="table-context-menu"
      :style="{ left: tableMenu.x + 'px', top: tableMenu.y + 'px' }"
    >
      <button
        v-for="action in TABLE_ACTIONS"
        :key="action.value"
        :class="{ danger: action.value.startsWith('delete') }"
        @click="runTableAction(action.value)"
      >
        {{ action.label }}
      </button>
    </div>

    <!-- Menu contestuale al tasto destro (fuori da una tabella, altrimenti è
         il tableMenu sopra a comparire): stessa struttura/posizionamento di
         quello, azioni raggruppate per tipo (appunti, formattazione, extra). -->
    <div
      v-if="contextMenu.visible"
      ref="contextMenuEl"
      class="table-context-menu editor-context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    >
      <template v-for="(group, gi) in EDITOR_CONTEXT_ACTIONS" :key="gi">
        <div v-if="gi > 0" class="context-menu-sep"></div>
        <button v-for="action in group" :key="action.value" @click="runContextAction(action.value)">
          <Icon :icon="action.icon" />
          <span>{{ action.label }}</span>
        </button>
      </template>
    </div>

    <!-- Electron non implementa window.prompt() (ritorna sempre null senza
         mostrare nulla): questo dialogo sostituisce il prompt nativo per
         link e immagini (vedi openValuePrompt/confirmValuePrompt). Per i
         link ha due campi (indirizzo + testo) e si riapre in modifica
         cliccando su un link già inserito (vedi onEditorClick). -->
    <div v-if="valuePrompt.visible" class="value-prompt-backdrop" @mousedown.self="cancelValuePrompt">
      <div class="value-prompt" :class="{ 'value-prompt-wide': valuePrompt.kind === 'image' }">
        <template v-if="valuePrompt.kind === 'link'">
          <div class="value-prompt-label">Indirizzo del link</div>
          <input
            ref="valuePromptUrlEl"
            v-model="valuePrompt.url"
            type="text"
            placeholder="https://..."
            @keydown.enter="confirmValuePrompt"
            @keydown.esc="cancelValuePrompt"
          />
          <div class="value-prompt-label value-prompt-label-spaced">Testo da visualizzare</div>
          <input
            v-model="valuePrompt.text"
            type="text"
            placeholder="(vuoto = usa l'indirizzo)"
            @keydown.enter="confirmValuePrompt"
            @keydown.esc="cancelValuePrompt"
          />
        </template>
        <template v-else>
          <div class="value-prompt-label">Immagine</div>
          <div class="value-prompt-image-source">
            <button type="button" class="value-prompt-browse" @click="pickLocalImage">
              <Icon icon="lucide:folder-open" />
              <span>Scegli file...</span>
            </button>
            <span class="value-prompt-or">oppure incolla un URL o trascina un file qui sotto</span>
          </div>
          <input
            ref="valuePromptUrlEl"
            v-model="valuePrompt.url"
            type="text"
            placeholder="https://esempio.com/immagine.png"
            @keydown.enter="confirmValuePrompt"
            @keydown.esc="cancelValuePrompt"
          />

          <div
            ref="cropAreaEl"
            class="value-prompt-image-preview"
            :class="{ 'is-drag-over': isDraggingOver, 'is-empty': !valuePrompt.url, 'is-cropping': editing.cropping }"
            @dragover.prevent="isDraggingOver = true"
            @dragleave.prevent="isDraggingOver = false"
            @drop.prevent="onImageDrop"
            @mousedown="startCropDrag"
          >
            <template v-if="valuePrompt.url">
              <img
                v-show="!imagePreviewFailed"
                :src="imagePreviewSrc"
                draggable="false"
                @error="imagePreviewFailed = true"
                @load="imagePreviewFailed = false"
              />
              <div v-if="imagePreviewFailed" class="value-prompt-image-error">Anteprima non disponibile</div>
              <div v-if="editing.cropping && editing.cropRect" class="value-prompt-crop-box" :style="cropBoxStyle"></div>
            </template>
            <template v-else>
              <div class="value-prompt-image-placeholder">
                <Icon icon="lucide:image" />
                <span>Trascina qui un'immagine</span>
              </div>
            </template>
          </div>

          <div v-if="valuePrompt.url && !imagePreviewFailed" class="value-prompt-image-tools">
            <template v-if="!editing.cropping">
              <button type="button" title="Ruota a sinistra" :disabled="editing.busy" @click="rotate(-90)">
                <Icon icon="lucide:rotate-ccw" />
              </button>
              <button type="button" title="Ruota a destra" :disabled="editing.busy" @click="rotate(90)">
                <Icon icon="lucide:rotate-cw" />
              </button>
              <button type="button" title="Ritaglia" :disabled="editing.busy" @click="startCrop">
                <Icon icon="lucide:crop" />
              </button>
              <span class="value-prompt-tools-sep"></span>
              <span class="value-prompt-tools-label">Ridimensiona</span>
              <button type="button" :disabled="editing.busy" @click="scaleBy(0.75)">75%</button>
              <button type="button" :disabled="editing.busy" @click="scaleBy(0.5)">50%</button>
            </template>
            <template v-else>
              <span class="value-prompt-tools-label">Trascina per selezionare l'area da ritagliare</span>
              <div class="value-prompt-actions-spacer"></div>
              <button type="button" @click="cancelCrop">Annulla</button>
              <button type="button" class="value-prompt-ok" :disabled="!editing.cropRect || editing.busy" @click="applyCrop">
                Applica ritaglio
              </button>
            </template>
          </div>
          <div v-if="editing.error" class="value-prompt-image-error value-prompt-image-error-inline">{{ editing.error }}</div>
        </template>
        <div class="value-prompt-actions">
          <button v-if="valuePrompt.editing" class="value-prompt-remove" @click="removeValueLink">Rimuovi link</button>
          <div class="value-prompt-actions-spacer"></div>
          <button class="value-prompt-cancel" @click="cancelValuePrompt">Annulla</button>
          <button class="value-prompt-ok" @click="confirmValuePrompt">Conferma</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Il bottone che apre questo overlay vive fuori dal template di questo
       componente (iniettato da Quill/noi in toolbarContainer, vedi
       openColorPicker), quindi non c'è un antenato comune su cui ancorare
       un position:absolute — Teleport + position:fixed calcolata al click. -->
  <Teleport to="body">
    <div
      v-if="colorPickerOpen"
      ref="colorPickerEl"
      class="color-picker-overlay"
      :style="colorPickerPos"
      @mousedown.stop
    >
      <Vue3ColorPicker
        v-model="colorPickerValue"
        mode="solid"
        :theme="settings.isDark ? 'dark' : 'light'"
        type="HEX"
        :showEyeDrop="false"
        :showColorList="true"
        @update:model-value="(v) => onColorPicked('color', v)"
      />
    </div>
  </Teleport>
  <Teleport to="body">
    <div
      v-if="highlightPickerOpen"
      ref="highlightPickerEl"
      class="color-picker-overlay"
      :style="colorPickerPos"
      @mousedown.stop
    >
      <Vue3ColorPicker
        v-model="highlightPickerValue"
        mode="solid"
        :theme="settings.isDark ? 'dark' : 'light'"
        type="HEX"
        :showEyeDrop="false"
        :showColorList="true"
        @update:model-value="(v) => onColorPicked('background', v)"
      />
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Quill from 'quill'
import hljs from 'highlight.js/lib/common'
import 'quill/dist/quill.snow.css'
import { Icon } from '@iconify/vue'
import { useToast } from 'primevue/usetoast'
import { useSettingsStore } from '../stores/settings'
import { api } from '../utils/api'
import { shortcut } from '../utils/shortcuts'
import { htmlToMarkdown } from '../utils/markdown'
import { Vue3ColorPicker } from '@cyhnkckali/vue3-color-picker'
import '@cyhnkckali/vue3-color-picker/dist/style.css'

const settings = useSettingsStore()
const toast = useToast()

const props = defineProps({
  noteId: { type: String, default: null },
  content: { type: String, default: '' },
  // Contenitore DOM esterno (rif. da NoteEditor.vue) dove montare la toolbar
  // di formattazione, così può stare visivamente sopra ai pulsanti azione
  // invece che nella posizione dove Quill la inserirebbe di default.
  toolbarContainer: { type: Object, default: null },
  // 'compact' | 'extended' (vedi TOOLBAR_HTML). La toolbar viene costruita da
  // Quill una sola volta all'init, quindi il genitore forza un remount
  // includendo questo valore nel :key invece di aggiornarla a caldo.
  toolbarMode: { type: String, default: 'compact' }
})

const emit = defineEmits(['change'])

const editorEl = ref(null)
let quill = null
let internalUpdate = false

// Formati dedicati alla ricerca (Cmd+F): applicati/rimossi con source
// 'silent' così non finiscono nel contenuto salvato né nella cronologia
// undo (il testo-change handler e la history di Quill ignorano 'silent').
// Registrati una sola volta a livello di modulo (non a ogni mount).
const InlineBlot = Quill.import('blots/inline')
class SearchHighlightBlot extends InlineBlot {}
SearchHighlightBlot.blotName = 'search-highlight'
SearchHighlightBlot.tagName = 'mark'
SearchHighlightBlot.className = 'ql-search-highlight'
class SearchHighlightActiveBlot extends InlineBlot {}
SearchHighlightActiveBlot.blotName = 'search-highlight-active'
SearchHighlightActiveBlot.tagName = 'mark'
SearchHighlightActiveBlot.className = 'ql-search-highlight-active'
Quill.register(SearchHighlightBlot, true)
Quill.register(SearchHighlightActiveBlot, true)

// Icona per il codice inline: di default Quill usa la stessa "</>" sia per
// code-block che per code (icons.js mappa entrambi su codeIcon). La versione
// precedente disegnava due backtick, che però risultavano quasi identici
// all'icona a virgolette della citazione qui accanto; due chevron "< >" senza
// la barra centrale si distinguono sia dalla citazione sia dal blocco di
// codice ("</>", con la barra).
const INLINE_CODE_ICON = `
  <svg viewbox="0 0 18 18">
    <polyline class="ql-stroke" points="7 5 3.5 9 7 13"></polyline>
    <polyline class="ql-stroke" points="11 5 14.5 9 11 13"></polyline>
  </svg>
`

// Azioni sulla tabella (righe/colonne): esposte tramite menu contestuale al
// tasto destro su una cella (vedi openTableMenu), non nella toolbar.
const TABLE_ACTIONS = [
  { value: 'insertRowAbove', label: 'Inserisci riga sopra' },
  { value: 'insertRowBelow', label: 'Inserisci riga sotto' },
  { value: 'insertColumnLeft', label: 'Inserisci colonna a sinistra' },
  { value: 'insertColumnRight', label: 'Inserisci colonna a destra' },
  { value: 'deleteRow', label: 'Elimina riga' },
  { value: 'deleteColumn', label: 'Elimina colonna' },
  { value: 'deleteTable', label: 'Elimina tabella' }
]

// Menu contestuale al tasto destro nel corpo della nota (fuori da una
// tabella, vedi onEditorContextMenu): tre gruppi, appunti/formattazione/
// extra, eseguiti da runContextAction. Gli stessi cinque stili raggruppati
// sotto "Aa" nella toolbar compatta, più link e un'azione di convenienza.
const EDITOR_CONTEXT_ACTIONS = [
  [
    { value: 'cut', label: 'Taglia', icon: 'lucide:scissors' },
    { value: 'copy', label: 'Copia', icon: 'lucide:copy' },
    { value: 'paste', label: 'Incolla', icon: 'lucide:clipboard-paste' },
    { value: 'paste-plain', label: 'Incolla senza formattazione', icon: 'lucide:clipboard-type' }
  ],
  [
    { value: 'bold', label: 'Grassetto', icon: 'lucide:bold' },
    { value: 'italic', label: 'Corsivo', icon: 'lucide:italic' },
    { value: 'underline', label: 'Sottolineato', icon: 'lucide:underline' },
    { value: 'strike', label: 'Barrato', icon: 'lucide:strikethrough' },
    { value: 'code', label: 'Codice inline', icon: 'lucide:code' },
    { value: 'link', label: 'Link...', icon: 'lucide:link' }
  ],
  [{ value: 'copy-markdown', label: 'Copia come Markdown', icon: 'lucide:clipboard-list' }]
]

const toolbarOptions = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike', 'code'],
  [{ color: [] }, { background: [] }],
  [{ list: ['ordered', 'bullet', 'unchecked', false] }],
  ['blockquote', 'code-block', 'link', 'image'],
  ['table'],
  ['clean']
]

// Markup equivalente a toolbarOptions, per quando la toolbar vive in un
// contenitore esterno: Quill non genera l'HTML in quel caso (lo fa solo per
// un array passato come modules.toolbar), ma la sua theme "snow" continua a
// riconoscere queste classi e ad aggiungere le icone automaticamente.
//
// I gruppi sono definiti una volta e ricomposti nelle due varianti di toolbar
// (vedi TOOLBAR_HTML sotto), così aggiungere un controllo non richiede di
// ricordarsi di aggiornare due markup paralleli.
const btn = (cls) => `<button class="${cls}" type="button"></button>`
const group = (...items) => `<span class="ql-formats">${items.join('')}</span>`

const G_HEADER = group(`
  <select class="ql-header">
    <option value="1"></option>
    <option value="2"></option>
    <option value="3"></option>
    <option selected></option>
  </select>
`)
const G_INLINE = group(
  btn('ql-bold'),
  btn('ql-italic'),
  btn('ql-underline'),
  btn('ql-strike'),
  btn('ql-code')
)
const G_BLOCK = group(
  `
  <select class="ql-list">
    <option value="ordered"></option>
    <option value="bullet"></option>
    <option value="unchecked"></option>
    <option selected></option>
  </select>
`,
  btn('ql-blockquote'),
  btn('ql-link')
)
const G_INSERT = group(btn('ql-code-block'), btn('ql-image'), btn('ql-table'))
const G_CLEAN = group(btn('ql-clean'))

// Mini-menu a comparsa iniettati nella toolbar (l'overflow "⋯" e, in modalità
// compatta, il gruppo di stili inline sotto "Aa"): stesso markup generico
// (.toolbar-dropdown/-toggle/-panel), la classe più specifica identifica quale
// sia per lo stato/comportamento in onMounted. Il toggle non ha classi ql-*,
// quindi il modulo Toolbar di Quill lo ignora (Toolbar.attach aggancia un
// handler solo a elementi con una classe che inizia per "ql-").
// "ql-formats" gli dà lo stesso divisorio verticale (margine/bordo) degli
// altri gruppi: senza, il dropdown si fonde visivamente col gruppo
// successivo, sembrando parte dello stesso insieme di controlli invece che
// un gruppo a sé. Quill non attribuisce significato a questa classe (la
// usa solo il CSS di questo file e quello di default per lo spacing), quindi
// aggiungerla al wrapper è sicuro: non è un <button>/<select>, il modulo
// Toolbar non ci aggancia nessun handler.
const dropdown = (name, icon, tip, ...groups) => `
  <span class="ql-formats toolbar-dropdown ${name}">
    <button type="button" class="toolbar-dropdown-toggle ${name}-toggle" data-tooltip="${tip}" aria-label="${tip}">${icon}</button>
    <div class="toolbar-dropdown-panel ${name}-panel">${groups.join('')}</div>
  </span>
`
const OVERFLOW_ICON = `
  <svg viewbox="0 0 18 18">
    <circle class="ql-fill" cx="3" cy="9" r="1.4"></circle>
    <circle class="ql-fill" cx="9" cy="9" r="1.4"></circle>
    <circle class="ql-fill" cx="15" cy="9" r="1.4"></circle>
  </svg>
`
const overflow = (...groups) => dropdown('toolbar-overflow', OVERFLOW_ICON, 'Altre opzioni di formattazione', ...groups)

// Bottoni custom al posto dei nativi <select class="ql-color">/"ql-background"
// di Quill: quel widget (Quill lo ricostruisce a runtime in un ql-picker con
// swatch, stato "espanso" e label SVG iniettata via JS) non mostra l'icona
// della label in WKWebView — bug riproducibile solo su quel motore, mai in
// Chromium, con CSS e markup verificati corretti. Stesso identico pattern di
// style-dropdown/overflow qui sopra (bottone statico + pannello), che invece
// funziona ovunque: aggira il problema alla radice invece di inseguirlo.
// "color-indicator" sulla riga/barra sotto il glifo: sincronizzata a mano su
// ogni cambio di selezione (vedi syncColorIndicators), stesso principio di
// syncStyleToggleActive qui sotto — mostra il colore/evidenziazione applicato
// al testo sotto il cursore, come faceva il picker nativo di Quill.
const COLOR_ICON = `
  <svg viewBox="0 0 18 18">
    <line class="ql-stroke color-indicator" x1="3" x2="15" y1="15" y2="15"></line>
    <polyline class="ql-stroke" points="5.5 11 9 3 12.5 11"></polyline>
    <line class="ql-stroke" x1="11.63" x2="6.38" y1="9" y2="9"></line>
  </svg>
`
// Stessa "A" dell'icona colore, non un pennarello: comunica meglio che è la
// stessa famiglia di controllo (testo) applicata a una proprietà diversa
// (sfondo invece di colore). Il rettangolo dietro le lettere è l'indicatore
// — vuoto (nessun riempimento) quando non c'è evidenziazione, colorato
// quando c'è, sincronizzato in syncColorIndicators come per COLOR_ICON.
const HIGHLIGHT_ICON = `
  <svg viewBox="0 0 18 18">
    <rect class="color-indicator" x="2" y="6.3" width="14" height="6.7" rx="1.2"></rect>
    <polyline class="ql-stroke" points="5.5 11 9 3 12.5 11"></polyline>
    <line class="ql-stroke" x1="11.63" x2="6.38" y1="9" y2="9"></line>
  </svg>
`
// Nessun pannello iniettato qui (gruppi vuoti): il color picker vero è un
// componente Vue (Vue3ColorPicker, vedi <template>), non ottenibile con le
// stringhe HTML imperative usate per il resto della toolbar. Il bottone
// apre/chiude un overlay Vue posizionato sopra questo toggle — vedi
// openColorPicker più sotto.
// Nessun pannello iniettato qui (gruppi vuoti): il color picker vero è un
// componente Vue (Vue3ColorPicker, vedi <template>), non ottenibile con le
// stringhe HTML imperative usate per il resto della toolbar. Il bottone
// apre/chiude direttamente l'overlay Vue — vedi openColorPicker più sotto.
const colorDropdown = () => dropdown('color-dropdown', COLOR_ICON, 'Colore del testo')
const highlightDropdown = () => dropdown('highlight-dropdown', HIGHLIGHT_ICON, 'Colore di evidenziazione')

// Palette usata solo per pre-popolare la cronologia di Vue3ColorPicker al
// primo avvio (vedi hasUsableColorList sotto) — non c'è più una griglia di
// quadretti nostra, il picker ha già la sua.
const DEFAULT_COLOR_PALETTE = [
  '#000000', '#ffffff', '#e60000', '#ff9900', '#ffff00', '#008a00',
  '#0066cc', '#9933ff', '#facccc', '#ffebcc', '#ffffcc', '#cce8cc',
  '#cce0f5', '#ebd6ff'
]

// Vue3ColorPicker tiene la sua lista di colori rapidi in localStorage
// (chiave "ck-cp-local-color-list", condivisa fra il picker del testo e
// quello di evidenziazione — non è configurabile via prop) e parte vuota
// finché l'utente non salva un colore da sé. La si pre-popola con la stessa
// palette rapida, ma solo se non c'è già una lista utilizzabile: non basta
// guardare se la chiave esiste, perché il componente stesso può avere già
// scritto "[]" (lista vuota) in un avvio precedente — una stringa non vuota,
// quindi "vera" per un controllo booleano ingenuo, ma senza colori dentro.
// Va guardato il contenuto, non la sola presenza della chiave.
function hasUsableColorList() {
  try {
    const parsed = JSON.parse(localStorage.getItem('ck-cp-local-color-list') || '[]')
    return Array.isArray(parsed) && parsed.length > 0
  } catch {
    return false
  }
}
// Versione della palette di default: forza una pulizia UNA TANTUM per
// versione (non a ogni avvio, altrimenti cancellerebbe i colori che
// l'utente ha scelto lui). Serve perché il browser di test (Chromium, usato
// per verificare le modifiche prima di questa) e la finestra Tauri vera
// (WKWebView) sono due applicazioni diverse anche puntando alla stessa URL
// in dev: non condividono lo storage, quindi un fix verificato di là non è
// mai arrivato di qua. Bump della versione se serve un altro reset in futuro.
const COLOR_PALETTE_RESET_VERSION = 'v1'
if (localStorage.getItem('ck-cp-reset-version') !== COLOR_PALETTE_RESET_VERSION) {
  localStorage.setItem('ck-cp-local-color-list', JSON.stringify(DEFAULT_COLOR_PALETTE))
  localStorage.setItem('ck-cp-reset-version', COLOR_PALETTE_RESET_VERSION)
} else if (!hasUsableColorList()) {
  localStorage.setItem('ck-cp-local-color-list', JSON.stringify(DEFAULT_COLOR_PALETTE))
}

// Stesse doppie frecce su/giù che Quill disegna nei suoi ".ql-picker-label"
// (titolo, lista): senza, "Aa" è testo puro e non comunica di essere un menu
// a comparsa come gli altri due picker qui accanto.
const PICKER_CHEVRON = `
  <svg viewBox="0 0 18 18">
    <polygon class="ql-stroke" points="7 11 9 13 11 11 7 11"></polygon>
    <polygon class="ql-stroke" points="7 7 9 5 11 7 7 7"></polygon>
  </svg>
`

// "Aa" invece di un'icona disegnata a mano: è la convenzione già usata da
// più editor per un menu di stili testo, leggibile a colpo d'occhio senza
// dover indovinare cosa rappresenti un glifo custom.
const styleDropdown = () =>
  dropdown(
    'style-dropdown',
    `<span class="style-dropdown-label">Aa</span>${PICKER_CHEVRON}`,
    `Stile testo: grassetto (${shortcut('mod+B')}), corsivo (${shortcut('mod+I')}), sottolineato (${shortcut('mod+U')}), barrato (${shortcut('mod+shift+X')}), codice inline (${shortcut('mod+E')})`,
    G_INLINE
  )
const G_COLOR = colorDropdown() + highlightDropdown()

// Due layout, scelti dal menu "Vista > Toolbar" (vedi main/menu.js) e
// persistiti in settings.toolbarMode:
// - compact: solo i controlli più usati, con gli stili inline (grassetto,
//   corsivo, sottolineato, barrato, codice) raggruppati sotto "Aa" e il resto
//   in un menu "⋯", così l'header non va mai a capo nemmeno a finestra stretta
// - extended: tutto visibile, senza dropdown (a finestra stretta la toolbar
//   scorre orizzontalmente, vedi .floating-toolbar in NoteEditor.vue)
const TOOLBAR_HTML = {
  compact: G_HEADER + styleDropdown() + G_BLOCK + overflow(G_COLOR, G_INSERT, G_CLEAN),
  extended: G_HEADER + G_INLINE + G_COLOR + G_BLOCK + G_INSERT + G_CLEAN
}

// Tooltip di ogni controllo, con la relativa scorciatoia. Applicati dopo
// l'init di Quill (vedi applyToolbarTooltips) invece che come attributi title
// nel markup: i <select> vengono sostituiti da Quill con un picker, quindi il
// title va messo sulla label generata da lui, non sull'elemento originale.
const TOOLBAR_TOOLTIPS = {
  'ql-header': `Stile del paragrafo (${shortcut('mod+alt+1')} … ${shortcut('mod+alt+0')})`,
  'ql-bold': `Grassetto (${shortcut('mod+B')})`,
  'ql-italic': `Corsivo (${shortcut('mod+I')})`,
  'ql-underline': `Sottolineato (${shortcut('mod+U')})`,
  'ql-strike': `Barrato (${shortcut('mod+shift+X')})`,
  'ql-code': `Codice inline (${shortcut('mod+E')})`,
  'ql-list': `Elenco: numerato (${shortcut('mod+shift+7')}), puntato (${shortcut('mod+shift+8')}), di controllo (${shortcut('mod+shift+9')})`,
  'ql-blockquote': `Citazione (${shortcut('mod+shift+B')})`,
  'ql-link': `Inserisci link (${shortcut('mod+K')})`,
  'ql-code-block': `Blocco di codice (${shortcut('mod+shift+C')})`,
  'ql-image': 'Inserisci immagine',
  'ql-table': 'Inserisci tabella (tasto destro su una cella per righe e colonne)',
  'ql-clean': 'Rimuovi formattazione'
}

// data-tooltip/aria-label invece di title: stesso motivo del pannello
// colore/evidenziazione (vedi dropdown() più sotto) — il tooltip nativo del
// browser è lento/inconsistente in WKWebView, quindi lo ricostruiamo in CSS
// (vedi .floating-toolbar :deep([data-tooltip]) in NoteEditor.vue) per tutti
// i controlli della toolbar, non solo per i due dropdown custom.
function applyToolbarTooltips(container) {
  if (!container) return
  Object.entries(TOOLBAR_TOOLTIPS).forEach(([cls, tip]) => {
    const target = container.querySelector(`button.${cls}`) || container.querySelector(`.${cls} .ql-picker-label`)
    if (target) {
      target.setAttribute('data-tooltip', tip)
      target.setAttribute('aria-label', tip)
    }
  })
}

// chiavi = nomi canonici di highlight.js (coerenti con normalizeLang in markdown.js)
const CODE_LANGUAGES = [
  { key: 'plain', label: 'Testo' },
  { key: 'javascript', label: 'JavaScript' },
  { key: 'typescript', label: 'TypeScript' },
  { key: 'python', label: 'Python' },
  { key: 'bash', label: 'Bash' },
  { key: 'json', label: 'JSON' },
  { key: 'yaml', label: 'YAML' },
  { key: 'xml', label: 'HTML/XML' },
  { key: 'css', label: 'CSS' },
  { key: 'scss', label: 'SCSS' },
  { key: 'java', label: 'Java' },
  { key: 'csharp', label: 'C#' },
  { key: 'cpp', label: 'C++' },
  { key: 'c', label: 'C' },
  { key: 'go', label: 'Go' },
  { key: 'rust', label: 'Rust' },
  { key: 'ruby', label: 'Ruby' },
  { key: 'php', label: 'PHP' },
  { key: 'sql', label: 'SQL' },
  { key: 'markdown', label: 'Markdown' }
]

function loadContent(html) {
  internalUpdate = true
  quill.setContents([])
  // Il paste di Quill (con modulo Syntax attivo) legge da solo data-language dal
  // <pre> e applica l'evidenziazione: nessun post-processing manuale necessario.
  if (html) quill.clipboard.dangerouslyPasteHTML(html)
  internalUpdate = false
}

// Scorciatoie di formattazione (in aggiunta a ⌘B/⌘I/⌘U nativi di Quill).
// Uso i keyCode numerici: shift+numero/lettera cambia evt.key a seconda del layout,
// mentre il keyCode resta stabile.
const toggle = (quill, range, name, value, current) =>
  quill.format(name, current === value ? false : value, 'user')

// Dialogo per link/immagine: Electron non implementa window.prompt() (ritorna
// sempre null senza mostrare nulla), quindi serve un input nostro. Per i link
// ha due campi (indirizzo + testo visualizzato) e si può riaprire in modifica
// su un link già esistente (editing=true), cliccandoci sopra (onEditorClick)
// o riaprendo il bottone/scorciatoia col cursore già dentro un link.
const valuePromptUrlEl = ref(null)
const valuePrompt = reactive({ visible: false, kind: null, index: 0, length: 0, url: '', text: '', editing: false })
const imagePreviewFailed = ref(false)
const imagePreviewSrc = ref('')
const LinkFormat = Quill.import('formats/link')

const IMAGE_TOO_LARGE_MSG = 'Immagine troppo grande (limite 8MB): scegline una più piccola o comprimila prima di aggiungerla.'
const IMAGE_READ_FAILED_MSG = 'Impossibile leggere questo file.'
const errorMessageFor = (code) => (code === 'too-large' ? IMAGE_TOO_LARGE_MSG : IMAGE_READ_FAILED_MSG)

// Il renderer dev è servito da http://localhost:5173, non file://: Chromium
// blocca il caricamento di risorse file:// da un'origine http (e per coerenza
// evitiamo il problema anche in produzione), quindi un percorso locale va
// letto e incorporato come data URI invece che referenziato per path. Un URL
// remoto o un data URI già pronto (dal file picker) si usano così come sono.
// Async e condivisa fra anteprima e inserimento finale, così quello che si
// vede è esattamente quello che verrà salvato.
async function resolveImageSrc(raw) {
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:')) return { src: raw }
  const path = raw.replace(/^file:\/\//, '')
  const result = await api.readLocalImage(path)
  if (!result) return { src: null }
  if (result.error) return { src: null, error: errorMessageFor(result.error) }
  return { src: result.dataUri }
}

// Apre il selettore file nativo (o l'equivalente <input type="file"> nel
// fallback browser): il file scelto arriva già come data URI (vedi
// pickImage), quindi qui non serve altra conversione.
async function pickLocalImage() {
  const result = await api.pickImage()
  if (!result) return
  if (result.error) {
    editing.error = errorMessageFor(result.error)
    return
  }
  valuePrompt.url = result.dataUri
}

// Trascinare un file immagine direttamente sull'anteprima è un'alternativa al
// bottone "Scegli file": stessa lettura come data URI.
function onImageDrop(event) {
  isDraggingOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  const reader = new FileReader()
  reader.onload = () => {
    valuePrompt.url = String(reader.result)
  }
  reader.readAsDataURL(file)
}

// Ruota/ridimensiona/ritaglia via canvas: funziona solo su data URI o su
// immagini remote che concedono CORS (altrimenti il canvas risulta "tainted"
// e toDataURL lancia una SecurityError, gestita mostrando editing.error).
function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('load-failed'))
    img.src = src
  })
}

const CANVAS_ERROR = 'Impossibile modificare questa immagine (probabilmente remota e senza permesso CORS).'

async function withImageEdit(transform) {
  editing.busy = true
  editing.error = ''
  try {
    const img = await loadImageElement(imagePreviewSrc.value)
    const canvas = transform(img)
    valuePrompt.url = canvas.toDataURL('image/png')
  } catch {
    editing.error = CANVAS_ERROR
  } finally {
    editing.busy = false
  }
}

function rotate(degrees) {
  return withImageEdit((img) => {
    const rad = (degrees * Math.PI) / 180
    const swap = Math.abs(degrees % 180) !== 0
    const canvas = document.createElement('canvas')
    canvas.width = swap ? img.height : img.width
    canvas.height = swap ? img.width : img.height
    const ctx = canvas.getContext('2d')
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(rad)
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    return canvas
  })
}

function scaleBy(factor) {
  return withImageEdit((img) => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * factor))
    canvas.height = Math.max(1, Math.round(img.height * factor))
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  })
}

// Ritaglio: si disegna un rettangolo di selezione trascinando sull'anteprima
// (coordinate in frazioni 0..1 relative all'immagine mostrata, indipendenti
// dallo zoom/dimensione del dialogo), poi si applica sull'immagine reale.
const cropAreaEl = ref(null)
const isDraggingOver = ref(false)
const editing = reactive({ busy: false, error: '', cropping: false, cropRect: null })
let cropDragStart = null

// Deve stare dopo la dichiarazione di "editing" qui sopra: con immediate:true
// Vue esegue subito la callback durante il setup, e riferirsi a "editing" da
// un punto del file precedente alla sua "const" lancia un ReferenceError da
// temporal dead zone (qui capitava dentro una funzione async, quindi finiva
// silenziosamente in una promise rifiutata invece di bloccare il mount).
watch(
  () => valuePrompt.url,
  async (raw) => {
    const trimmed = raw.trim()
    editing.error = ''
    if (!trimmed) {
      imagePreviewSrc.value = ''
      imagePreviewFailed.value = false
      return
    }
    const { src, error } = await resolveImageSrc(trimmed)
    // se nel frattempo il campo è cambiato ancora, questa risposta è superata
    if (valuePrompt.url.trim() !== trimmed) return
    imagePreviewSrc.value = src || ''
    imagePreviewFailed.value = !src
    if (error) editing.error = error
  },
  { immediate: true }
)

const cropBoxStyle = computed(() => {
  const r = editing.cropRect
  if (!r) return {}
  return { left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }
})

const clamp01 = (v) => Math.min(1, Math.max(0, v))

function startCrop() {
  editing.error = ''
  editing.cropping = true
  editing.cropRect = null
}

function cancelCrop() {
  editing.cropping = false
  editing.cropRect = null
}

function startCropDrag(event) {
  if (!editing.cropping || !cropAreaEl.value) return
  const rect = cropAreaEl.value.getBoundingClientRect()
  cropDragStart = { x: clamp01((event.clientX - rect.left) / rect.width), y: clamp01((event.clientY - rect.top) / rect.height) }
  editing.cropRect = { x: cropDragStart.x, y: cropDragStart.y, w: 0, h: 0 }
  window.addEventListener('mousemove', onCropDrag)
  window.addEventListener('mouseup', endCropDrag)
}

function onCropDrag(event) {
  if (!cropDragStart || !cropAreaEl.value) return
  const rect = cropAreaEl.value.getBoundingClientRect()
  const x = clamp01((event.clientX - rect.left) / rect.width)
  const y = clamp01((event.clientY - rect.top) / rect.height)
  editing.cropRect = {
    x: Math.min(cropDragStart.x, x),
    y: Math.min(cropDragStart.y, y),
    w: Math.abs(x - cropDragStart.x),
    h: Math.abs(y - cropDragStart.y)
  }
}

function endCropDrag() {
  window.removeEventListener('mousemove', onCropDrag)
  window.removeEventListener('mouseup', endCropDrag)
  cropDragStart = null
}

async function applyCrop() {
  const r = editing.cropRect
  if (!r || r.w < 0.02 || r.h < 0.02) {
    cancelCrop()
    return
  }
  await withImageEdit((img) => {
    const sx = r.x * img.width
    const sy = r.y * img.height
    const sw = r.w * img.width
    const sh = r.h * img.height
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sw))
    canvas.height = Math.max(1, Math.round(sh))
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    return canvas
  })
  editing.cropping = false
  editing.cropRect = null
}

function openValuePrompt(kind, range, prefill = {}) {
  if (!range) return
  valuePrompt.kind = kind
  valuePrompt.index = range.index
  valuePrompt.length = range.length
  valuePrompt.url = prefill.url || ''
  valuePrompt.text = prefill.text ?? (range.length > 0 ? quill.getText(range.index, range.length) : '')
  valuePrompt.editing = !!prefill.editing
  editing.busy = false
  editing.error = ''
  editing.cropping = false
  editing.cropRect = null
  valuePrompt.visible = true
  nextTick(() => valuePromptUrlEl.value?.focus())
}

function cancelValuePrompt() {
  valuePrompt.visible = false
  quill?.focus()
}

async function confirmValuePrompt() {
  const { kind, index, length } = valuePrompt
  if (kind === 'image') {
    const raw = valuePrompt.url.trim()
    if (!raw) {
      valuePrompt.visible = false
      return quill?.focus()
    }
    // Si ririsolve invece di fidarsi ciecamente di imagePreviewSrc: se si preme
    // Conferma subito dopo aver digitato, il watcher dell'anteprima potrebbe
    // non aver ancora finito la conversione asincrona del percorso locale.
    const { src, error } = await resolveImageSrc(raw)
    if (error) {
      editing.error = error
      return
    }
    valuePrompt.visible = false
    if (!src) return quill?.focus()
    quill.insertEmbed(index, 'image', src, 'user')
    quill.setSelection(index + 1, 0, 'user')
    quill.focus()
    return
  }
  const url = valuePrompt.url.trim()
  valuePrompt.visible = false
  if (!url) return quill?.focus()
  const text = valuePrompt.text.trim() || url
  // Sostituisce l'intero range (testo+link precedenti, se presenti) col nuovo
  // testo formattato: funziona sia per l'inserimento che per la modifica.
  quill.deleteText(index, length, 'user')
  quill.insertText(index, text, 'link', url, 'user')
  quill.setSelection(index + text.length, 0, 'user')
  quill.focus()
}

function removeValueLink() {
  const { index, length } = valuePrompt
  valuePrompt.visible = false
  quill.formatText(index, length, 'link', false, 'user')
  quill.setSelection(index + length, 0, 'user')
  quill.focus()
}

// Se il cursore è già dentro un link esistente, riapre il dialogo in
// modifica (precompilato) invece di crearne uno nuovo sopra.
function findLinkAt(index) {
  const [link, offset] = quill.scroll.descendant(LinkFormat, index)
  if (!link) return null
  return { index: index - offset, length: link.length(), url: link.domNode.getAttribute('href'), text: link.domNode.textContent }
}

// Un click su un link esistente nel contenuto riapre il dialogo invece di
// seguirlo: è il modo più diretto per modificarlo o rimuoverlo.
function onEditorClick(event) {
  const anchor = event.target.closest('a')
  if (!anchor || !quill.root.contains(anchor)) return
  event.preventDefault()
  const range = quill.getSelection(true)
  if (!range) return
  openLinkPromptForRange(range)
}

// Condivisa da bottone toolbar e scorciatoia da tastiera: se il cursore è già
// dentro un link esistente riapre il dialogo in modifica invece di creare un
// nuovo link sopra a quello presente.
function openLinkPromptForRange(range) {
  if (!range) return
  const existing = findLinkAt(range.index)
  if (existing) {
    openValuePrompt('link', { index: existing.index, length: existing.length }, { url: existing.url, text: existing.text, editing: true })
  } else {
    openValuePrompt('link', range)
  }
}

// Cerca nella nota (Cmd+F): ricerca case-insensitive su tutto il testo
// semplice, evidenziata con i due formati registrati sopra.
const findInputEl = ref(null)
const findBar = reactive({ visible: false, query: '', matches: [], currentIndex: -1 })

const findBarCountLabel = computed(() => {
  if (!findBar.query.trim()) return ''
  return findBar.matches.length ? `${findBar.currentIndex + 1}/${findBar.matches.length}` : '0/0'
})

function computeMatches(query) {
  if (!quill || !query) return []
  const haystack = quill.getText().toLowerCase()
  const needle = query.toLowerCase()
  const matches = []
  let from = 0
  while (true) {
    const idx = haystack.indexOf(needle, from)
    if (idx === -1) break
    matches.push({ index: idx, length: needle.length })
    from = idx + needle.length
  }
  return matches
}

function clearHighlights() {
  if (!quill) return
  const length = quill.getLength()
  quill.formatText(0, length, 'search-highlight', false, 'silent')
  quill.formatText(0, length, 'search-highlight-active', false, 'silent')
}

function applyHighlights() {
  clearHighlights()
  findBar.matches.forEach((m, i) => {
    const format = i === findBar.currentIndex ? 'search-highlight-active' : 'search-highlight'
    quill.formatText(m.index, m.length, format, true, 'silent')
  })
}

// Solo scroll, niente quill.setSelection(): setSelection sposta sempre il
// focus DOM nativo sull'editor (indipendentemente dal source passato a
// Quill, che riguarda solo il suo sistema di eventi interno), il che
// strapperebbe il focus dal campo di ricerca a ogni tasto premuto.
function scrollToCurrentMatch() {
  const m = findBar.matches[findBar.currentIndex]
  if (!m || !quill || !editorEl.value) return
  const bounds = quill.getBounds(m.index, m.length)
  if (!bounds) return
  const container = editorEl.value
  const target = container.scrollTop + bounds.top - container.clientHeight / 2
  container.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
}

function runSearch() {
  findBar.matches = computeMatches(findBar.query.trim())
  findBar.currentIndex = findBar.matches.length ? 0 : -1
  applyHighlights()
  scrollToCurrentMatch()
}

watch(() => findBar.query, runSearch)

function nextMatch() {
  if (!findBar.matches.length) return
  findBar.currentIndex = (findBar.currentIndex + 1) % findBar.matches.length
  applyHighlights()
  scrollToCurrentMatch()
  findInputEl.value?.focus()
}

function prevMatch() {
  if (!findBar.matches.length) return
  findBar.currentIndex = (findBar.currentIndex - 1 + findBar.matches.length) % findBar.matches.length
  applyHighlights()
  scrollToCurrentMatch()
  findInputEl.value?.focus()
}

function openFindBar() {
  findBar.visible = true
  nextTick(() => findInputEl.value?.focus())
}

// Richiamato dal bottone "Cerca" nell'action-card di NoteEditor.vue (oltre a ⌘F).
function toggleFindBar() {
  if (findBar.visible) closeFindBar()
  else openFindBar()
}

function closeFindBar() {
  // Alla chiusura (non durante la digitazione) si sposta anche il cursore
  // reale sull'ultimo risultato attivo, così si riprende a scrivere lì.
  const m = findBar.matches[findBar.currentIndex]
  findBar.visible = false
  clearHighlights()
  findBar.matches = []
  findBar.currentIndex = -1
  if (m && quill) quill.setSelection(m.index, m.length, 'user')
  quill?.focus()
}

const editorBindings = {
  findInNote: { key: 70, shortKey: true, handler() { openFindBar(); return false } },
  strike: { key: 88, shortKey: true, shiftKey: true, handler(r, c) { toggle(this.quill, r, 'strike', true, c.format.strike); return false } },
  code: { key: 69, shortKey: true, handler(r, c) { toggle(this.quill, r, 'code', true, c.format.code); return false } },
  h1: { key: 49, shortKey: true, altKey: true, handler(r, c) { toggle(this.quill, r, 'header', 1, c.format.header); return false } },
  h2: { key: 50, shortKey: true, altKey: true, handler(r, c) { toggle(this.quill, r, 'header', 2, c.format.header); return false } },
  h3: { key: 51, shortKey: true, altKey: true, handler(r, c) { toggle(this.quill, r, 'header', 3, c.format.header); return false } },
  normal: { key: 48, shortKey: true, altKey: true, handler() { this.quill.format('header', false, 'user'); return false } },
  orderedList: { key: 55, shortKey: true, shiftKey: true, handler(r, c) { toggle(this.quill, r, 'list', 'ordered', c.format.list); return false } },
  bulletList: { key: 56, shortKey: true, shiftKey: true, handler(r, c) { toggle(this.quill, r, 'list', 'bullet', c.format.list); return false } },
  checkList: { key: 57, shortKey: true, shiftKey: true, handler(r, c) { const on = c.format.list === 'checked' || c.format.list === 'unchecked'; this.quill.format('list', on ? false : 'unchecked', 'user'); return false } },
  blockquote: { key: 66, shortKey: true, shiftKey: true, handler(r, c) { this.quill.format('blockquote', !c.format.blockquote, 'user'); return false } },
  codeBlock: { key: 67, shortKey: true, shiftKey: true, handler(r, c) { this.quill.format('code-block', !c.format['code-block'], 'user'); return false } },
  link: { key: 75, shortKey: true, handler(r) { openLinkPromptForRange(r); return false } }
}

// Il bottone tabella non corrisponde a un toggle di formattazione: inserisce
// una tabella 2x2 alla posizione del cursore tramite il modulo Table di Quill.
function insertTable() {
  this.quill.getModule('table')?.insertTable(2, 2)
}

// Sovrascrivono i default di Quill/Snow: il link di default richiede una
// selezione preesistente (altrimenti l'handler ritorna silenziosamente senza
// alcun feedback, sembrando "rotto"), e l'immagine di default apre un file
// picker che incorpora il file come base64 invece di linkarlo per path/URL.
function toolbarLink() {
  openLinkPromptForRange(this.quill.getSelection(true))
}
function toolbarImage() {
  openValuePrompt('image', this.quill.getSelection(true))
}

// Righe/colonne: menu contestuale al tasto destro su una cella. Le API del
// modulo Table agiscono sulla cella/tabella dove si trova il cursore, che il
// browser posiziona già correttamente al mousedown del tasto destro (prima
// che l'evento 'contextmenu' arrivi), quindi non serve impostarla a mano.
const tableMenuEl = ref(null)
const tableMenu = reactive({ visible: false, x: 0, y: 0 })

async function openTableMenu(event) {
  if (!event.target.closest('td') || !quill.getModule('table')) return
  event.preventDefault()
  tableMenu.x = event.clientX
  tableMenu.y = event.clientY
  tableMenu.visible = true
  // il menu può uscire dal viewport se il click è vicino al bordo destro/basso
  // della finestra: lo si riposiziona solo dopo che è nel DOM (serve la sua misura reale).
  await nextTick()
  const rect = tableMenuEl.value?.getBoundingClientRect()
  if (!rect) return
  const margin = 8
  if (rect.right > window.innerWidth - margin) tableMenu.x -= rect.right - (window.innerWidth - margin)
  if (rect.bottom > window.innerHeight - margin) tableMenu.y -= rect.bottom - (window.innerHeight - margin)
}

function closeTableMenu() {
  tableMenu.visible = false
}

function runTableAction(value) {
  quill.getModule('table')?.[value]?.()
  closeTableMenu()
}

// Menu contestuale al tasto destro nel corpo della nota (fuori da una
// tabella, vedi onEditorContextMenu): la selezione va catturata QUI, prima
// che il menu rubi il focus dall'editor, altrimenti al click su una voce
// quill.getSelection() potrebbe non restituire più il range giusto.
const contextMenuEl = ref(null)
const contextMenu = reactive({ visible: false, x: 0, y: 0, range: null })

async function openContextMenu(event) {
  event.preventDefault()
  contextMenu.range = quill.getSelection(true)
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.visible = true
  await nextTick()
  const rect = contextMenuEl.value?.getBoundingClientRect()
  if (!rect) return
  const margin = 8
  if (rect.right > window.innerWidth - margin) contextMenu.x -= rect.right - (window.innerWidth - margin)
  if (rect.bottom > window.innerHeight - margin) contextMenu.y -= rect.bottom - (window.innerHeight - margin)
}

function closeContextMenu() {
  contextMenu.visible = false
}

async function runContextAction(value) {
  const range = contextMenu.range
  closeContextMenu()
  quill.focus()
  if (range) quill.setSelection(range.index, range.length, 'silent')
  switch (value) {
    case 'cut':
    case 'copy':
    case 'paste':
      // execCommand funziona qui perché parte da un vero click dell'utente
      // (voce di menu), lo stesso vincolo che si applicherebbe a un
      // equivalente basato su navigator.clipboard.
      document.execCommand(value)
      break
    case 'paste-plain': {
      // execCommand('paste') incolla sempre con la formattazione della
      // sorgente: per il testo semplice serve leggere gli appunti e inserirli
      // come testo puro, sostituendo l'eventuale selezione come farebbe un
      // incolla normale.
      const text = await navigator.clipboard.readText()
      if (!text || !range) break
      if (range.length) quill.deleteText(range.index, range.length, 'user')
      quill.insertText(range.index, text, 'user')
      quill.setSelection(range.index + text.length, 0, 'user')
      break
    }
    case 'bold':
    case 'italic':
    case 'underline':
    case 'strike':
    case 'code': {
      const current = quill.getFormat(range)[value]
      toggle(quill, range, value, true, current)
      break
    }
    case 'link':
      openLinkPromptForRange(range)
      break
    case 'copy-markdown': {
      // Solo la selezione se non è vuota, altrimenti l'intera nota: lo stesso
      // criterio di "cosa copio" che ci si aspetterebbe da un tasto destro.
      const html = range?.length ? quill.getSemanticHTML(range.index, range.length) : quill.getSemanticHTML()
      navigator.clipboard.writeText(htmlToMarkdown(html))
      toast.add({ severity: 'success', summary: 'Copiato come Markdown', life: 1800 })
      break
    }
  }
}

// Mini-menu della toolbar di formattazione (overflow "⋯" e, in compatta, lo
// stile testo sotto "Aa" — vedi TOOLBAR_HTML): apertura/chiusura gestite a
// mano perché quel markup vive fuori dal template Vue (iniettato
// imperativamente da Quill nel contenitore esterno). Un array invece di due
// variabili perché il numero di dropdown presenti dipende dalla modalità
// (in estesa non ce n'è nessuno).
let toolbarDropdownEls = []

// Vue3ColorPicker è un componente Vue vero, quindi vive nel <template> (vedi
// in fondo) invece che nell'HTML imperativo del resto della toolbar. Aperto
// come overlay posizionato sopra il bottone che lo ha invocato — position
// calcolata al click, non con CSS, perché il bottone che lo apre non è un
// elemento del template di questo componente (è iniettato da Quill/noi nel
// contenitore esterno) e non c'è un antenato comune su cui ancorare un
// position:absolute.
const colorPickerOpen = ref(false)
const highlightPickerOpen = ref(false)
const colorPickerPos = ref({ top: '0px', left: '0px' })
const colorPickerValue = ref('#000000')
const highlightPickerValue = ref('#ffff00')
const colorPickerEl = ref(null)
const highlightPickerEl = ref(null)
// Assegnati in onMounted, letti da onGlobalMousedown: due funzioni separate,
// serve una variabile condivisa a livello di modulo (stesso motivo di `quill`).
let colorToggleWrapperEl = null
let highlightToggleWrapperEl = null

// Chiamata dal bottone toggle stesso: apre/chiude l'overlay Vue3ColorPicker.
function openColorPicker(format, toggleEl) {
  const rect = toggleEl.getBoundingClientRect()
  colorPickerPos.value = { top: `${rect.bottom + 6}px`, left: `${rect.left}px` }
  if (format === 'color') {
    highlightPickerOpen.value = false
    colorPickerOpen.value = !colorPickerOpen.value
  } else {
    colorPickerOpen.value = false
    highlightPickerOpen.value = !highlightPickerOpen.value
  }
}

// @update:model-value di Vue3ColorPicker spara ad ogni trascinamento nel
// picker, non solo alla conferma: va bene, è la stessa anteprima live che
// dava già <input type="color">. Il focus va ripristinato a mano per lo
// stesso motivo dei vecchi swatch-btn: aprire il picker toglie la selezione
// all'editor, e Quill la ricorda solo se richiamata con quill.focus().
function onColorPicked(format, value) {
  quill.focus()
  quill.format(format, value)
}

function toggleDropdown(el, event) {
  event.stopPropagation()
  const wasOpen = el.classList.contains('is-open')
  toolbarDropdownEls.forEach((d) => d.classList.remove('is-open'))
  if (!wasOpen) el.classList.add('is-open')
}

function onGlobalMousedown(event) {
  if (tableMenu.visible && !tableMenuEl.value?.contains(event.target)) {
    closeTableMenu()
  }
  if (contextMenu.visible && !contextMenuEl.value?.contains(event.target)) {
    closeContextMenu()
  }
  toolbarDropdownEls.forEach((el) => {
    if (el.classList.contains('is-open') && !el.contains(event.target)) el.classList.remove('is-open')
  })
  // Il picker colore è un Teleport verso <body>: non è mai dentro
  // toolbarContainer, quindi non lo tocca il forEach sopra. Il click sul
  // bottone che lo apre non deve richiuderlo nello stesso giro (altrimenti
  // toggle e mousedown-fuori si annullerebbero a vicenda): entrambi i
  // toggle sono esclusi esplicitamente dal controllo "fuori".
  if (
    colorPickerOpen.value &&
    !colorPickerEl.value?.contains(event.target) &&
    !colorToggleWrapperEl?.contains(event.target)
  ) {
    colorPickerOpen.value = false
  }
  if (
    highlightPickerOpen.value &&
    !highlightPickerEl.value?.contains(event.target) &&
    !highlightToggleWrapperEl?.contains(event.target)
  ) {
    highlightPickerOpen.value = false
  }
}

// Il tasto destro su una cella apre il menu della tabella (righe/colonne,
// vedi openTableMenu); altrove nel corpo della nota apre il menu generico
// qui sopra. Un solo listener 'contextmenu' instrada tra i due invece di
// registrarne due che si contenderebbero preventDefault().
function onEditorContextMenu(event) {
  if (event.target.closest('td') && quill.getModule('table')) openTableMenu(event)
  else openContextMenu(event)
}

onMounted(async () => {
  // Al primissimo mount della vista, il ref del contenitore esterno (passato
  // dal genitore) può risultare ancora null qui: viene assegnato durante il
  // mount dell'elemento fratello nella STESSA passata di render in cui questo
  // componente calcola le sue props, quindi il valore "fresco" arriva un tick
  // dopo. Aspettarlo evita di ricadere sulla toolbar generata da Quill nella
  // sua posizione/stile di default.
  await nextTick()

  let toolbarContainer = toolbarOptions
  if (props.toolbarContainer) {
    props.toolbarContainer.innerHTML = TOOLBAR_HTML[props.toolbarMode] || TOOLBAR_HTML.compact
    toolbarContainer = props.toolbarContainer
  }

  quill = new Quill(editorEl.value, {
    theme: 'snow',
    modules: {
      toolbar: {
        container: toolbarContainer,
        handlers: { table: insertTable, link: toolbarLink, image: toolbarImage }
      },
      table: true,
      syntax: { hljs, languages: CODE_LANGUAGES },
      keyboard: { bindings: editorBindings }
    }
  })

  // Quill usa la stessa icona "</>" sia per code-block che per code inline
  // (icons['code'] === icons['code-block']): la sostituiamo per distinguerle.
  const inlineCodeButton = quill.getModule('toolbar').container.querySelector('button.ql-code')
  if (inlineCodeButton) inlineCodeButton.innerHTML = INLINE_CODE_ICON

  // In modalità estesa non c'è nessun dropdown: i query restano null e i
  // listener semplicemente non vengono agganciati.
  toolbarDropdownEls = []
  const overflowEl = props.toolbarContainer?.querySelector('.toolbar-overflow') || null
  if (overflowEl) {
    toolbarDropdownEls.push(overflowEl)
    overflowEl
      .querySelector('.toolbar-overflow-toggle')
      ?.addEventListener('click', (event) => toggleDropdown(overflowEl, event))
    // Chiude il pannello subito dopo un'azione diretta (bottone o voce colore
    // scelta), non dopo l'apertura di un picker (che richiede un secondo click).
    overflowEl.addEventListener('click', (event) => {
      const actedImmediately = event.target.closest(
        'button.ql-code-block, button.ql-image, button.ql-table, button.ql-clean, .ql-picker-item'
      )
      if (actedImmediately) requestAnimationFrame(() => overflowEl.classList.remove('is-open'))
    })
  }
  const styleEl = props.toolbarContainer?.querySelector('.style-dropdown') || null
  let styleToggleEl = null
  if (styleEl) {
    toolbarDropdownEls.push(styleEl)
    styleToggleEl = styleEl.querySelector('.style-dropdown-toggle')
    styleToggleEl?.addEventListener('click', (event) => toggleDropdown(styleEl, event))
    // Qui ogni bottone è un toggle immediato (grassetto/corsivo/...), non un
    // picker a più passaggi: si chiude sempre, senza distinguere il target.
    styleEl.addEventListener('click', (event) => {
      if (event.target.closest('button.ql-bold, button.ql-italic, button.ql-underline, button.ql-strike, button.ql-code')) {
        requestAnimationFrame(() => styleEl.classList.remove('is-open'))
      }
    })
  }

  // Bottoni colore/evidenziazione (vedi colorDropdown/highlightDropdown sopra):
  // niente <select>, quindi il modulo Toolbar di Quill non li vede — il
  // formato va applicato a mano allo swatch cliccato.
  const colorEl = props.toolbarContainer?.querySelector('.color-dropdown') || null
  const highlightEl = props.toolbarContainer?.querySelector('.highlight-dropdown') || null
  const colorIndicatorEl = colorEl?.querySelector('.color-indicator') || null
  const highlightIndicatorEl = highlightEl?.querySelector('.color-indicator') || null
  colorToggleWrapperEl = colorEl
  highlightToggleWrapperEl = highlightEl

  // Niente pannello da aprire/chiudere via classe qui (vedi colorDropdown/
  // highlightDropdown sopra): il toggle apre l'overlay Vue3ColorPicker,
  // gestito con lo stato reattivo dichiarato a inizio file.
  colorEl?.querySelector('.toolbar-dropdown-toggle')?.addEventListener('click', (event) => {
    openColorPicker('color', event.currentTarget)
  })
  highlightEl?.querySelector('.toolbar-dropdown-toggle')?.addEventListener('click', (event) => {
    openColorPicker('background', event.currentTarget)
  })

  // Riflette sull'icona il colore/evidenziazione applicato al testo sotto il
  // cursore, come faceva il picker nativo di Quill. Stile inline invece di
  // una classe perché il valore è arbitrario (uno qualsiasi dei 14 colori, o
  // uno importato da fuori l'app): non enumerabile in CSS. Stringa vuota
  // rimuove l'override e fa tornare al colore neutro di .ql-stroke/.ql-fill.
  function syncColorIndicators() {
    const range = quill.getSelection()
    const format = range ? quill.getFormat(range) : {}
    if (colorIndicatorEl) colorIndicatorEl.style.stroke = format.color || ''
    // Il rettangolo di sfondo di HIGHLIGHT_ICON parte "vuoto" (solo contorno,
    // vedi CSS): '' toglie l'override e torna a quello stato invece di
    // riempirlo di nero, che sarebbe il default SVG di un <rect> senza fill.
    if (highlightIndicatorEl) highlightIndicatorEl.style.fill = format.background || ''
  }

  // Raggruppando i 5 stili sotto "Aa" si perde il segnale che quill dà da
  // solo ai bottoni ql-* (classe ql-active in base al formato sotto il
  // cursore): quill non lo applica al nostro toggle custom, quindi lo
  // sincronizziamo a mano su ogni cambio di selezione/testo.
  const STYLE_FORMATS = ['bold', 'italic', 'underline', 'strike', 'code']
  function syncStyleToggleActive() {
    if (!styleToggleEl) return
    const range = quill.getSelection()
    const format = range ? quill.getFormat(range) : {}
    styleToggleEl.classList.toggle('is-active', STYLE_FORMATS.some((f) => format[f]))
  }

  applyToolbarTooltips(quill.getModule('toolbar').container)

  loadContent(props.content)
  applySpellcheck()
  quill.root.addEventListener('contextmenu', onEditorContextMenu)
  quill.root.addEventListener('click', onEditorClick)
  window.addEventListener('mousedown', onGlobalMousedown)

  quill.on('text-change', (_delta, _oldDelta, source) => {
    // solo modifiche dell'utente: il load e la normalizzazione interna non vanno salvati
    if (internalUpdate || source !== 'user') return
    // getSemanticHTML() serializza dal modello Delta, escludendo gli elementi UI
    // iniettati nel DOM (es. il <select> lingua dei code block): quill.root.innerHTML
    // includerebbe quel <select>, facendolo finire salvato nel contenuto della nota.
    const html = quill.getSemanticHTML()
    emit('change', html === '<p><br></p>' ? '' : html)
    // il testo è cambiato: le posizioni dei risultati trovati finora non sono
    // più valide, si ricalcolano sul contenuto aggiornato.
    if (findBar.visible && findBar.query.trim()) runSearch()
  })

  quill.on('editor-change', syncStyleToggleActive)
  quill.on('editor-change', syncColorIndicators)
})

function applySpellcheck() {
  if (!quill) return
  quill.root.setAttribute('spellcheck', settings.spellcheck ? 'true' : 'false')
  if (settings.spellcheck) quill.root.setAttribute('lang', settings.spellLang)
  else quill.root.removeAttribute('lang')
}

watch(() => [settings.spellcheck, settings.spellLang], applySpellcheck)

watch(
  () => props.noteId,
  () => {
    if (!quill) return
    loadContent(props.content)
  }
)

function focusEditor() {
  quill?.focus()
}

defineExpose({ focusEditor, toggleFindBar })

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', onGlobalMousedown)
  quill = null
})
</script>

<style scoped>
.quill-editor {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* Cerca nella nota: barra fissa in alto a destra rispetto all'area di
   editing, non blocca l'interazione col resto (niente backdrop, a differenza
   del dialogo link/immagine). */
.find-bar {
  position: absolute;
  top: 10px;
  right: 16px;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--editor-toolbar-bg);
  border: 1px solid var(--p-content-border-color);
  border-radius: 9px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  padding: 6px 8px;
}
.find-bar :deep(svg) {
  font-size: 14px;
  color: var(--icon-color);
  flex-shrink: 0;
}
.find-bar input {
  width: 160px;
  background: var(--search-bg);
  border: 1px solid var(--p-content-border-color);
  border-radius: 6px;
  padding: 4px 7px;
  font-size: 12px;
  color: var(--p-text-color);
  outline: none;
}
.find-bar-count {
  font-size: 11px;
  color: var(--p-text-muted-color);
  min-width: 34px;
  text-align: center;
}
.find-bar button {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--icon-color);
  cursor: pointer;
  padding: 3px;
  border-radius: 5px;
}
.find-bar button:hover {
  background: var(--selection-bg);
}
.find-bar button:disabled {
  opacity: 0.4;
  cursor: default;
}
.quill-editor :deep(.ql-search-highlight) {
  background: rgba(255, 197, 23, 0.35);
  border-radius: 2px;
}
.quill-editor :deep(.ql-search-highlight-active) {
  background: #ffb020;
  color: #1a1a1a;
  border-radius: 2px;
}

/* Menu contestuale righe/colonne: aperto al tasto destro su una cella (vedi
   openTableMenu), posizionato al punto del click con position:fixed così le
   coordinate client (event.clientX/Y) valgono senza calcoli di scroll. */
.table-context-menu {
  position: fixed;
  z-index: 20;
  min-width: 190px;
  background: var(--editor-toolbar-bg);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  padding: 4px;
  display: flex;
  flex-direction: column;
}
.table-context-menu button {
  border: none;
  background: transparent;
  color: var(--p-text-color);
  text-align: left;
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 5px;
  cursor: pointer;
}
.table-context-menu button:hover {
  background: var(--selection-bg);
}
.table-context-menu button.danger {
  color: #e5484d;
}
.table-context-menu button.danger:hover {
  background: rgba(229, 72, 77, 0.14);
}
.table-context-menu button.danger:first-of-type {
  margin-top: 4px;
  border-top: 1px solid var(--p-content-border-color);
  padding-top: 8px;
}

/* Menu contestuale generico dell'editor (tasto destro fuori da una tabella,
   vedi onEditorContextMenu): voci con icona invece che solo testo, gruppi
   (appunti/formattazione/extra) separati da un divisorio invece che dal
   trattamento speciale "danger" usato per il menu tabella. */
.editor-context-menu {
  min-width: 200px;
}
.editor-context-menu button {
  display: flex;
  align-items: center;
  gap: 9px;
}
.editor-context-menu :deep(svg) {
  font-size: 15px;
  color: var(--icon-color);
  flex-shrink: 0;
}
.context-menu-sep {
  height: 1px;
  margin: 4px 6px;
  background: var(--p-content-border-color);
}

/* Dialogo per link/immagine: sostituisce window.prompt() (non implementato
   da Electron, vedi openValuePrompt). */
.value-prompt-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.value-prompt {
  width: 360px;
  max-width: calc(100% - 32px);
  background: var(--editor-toolbar-bg);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
  padding: 14px;
}
.value-prompt-wide {
  width: 480px;
}
.value-prompt-label {
  font-size: 13px;
  color: var(--p-text-color);
  margin-bottom: 8px;
}
.value-prompt-label-spaced {
  margin-top: 12px;
}
.value-prompt input {
  width: 100%;
  background: var(--search-bg);
  border: 1px solid var(--p-content-border-color);
  border-radius: 7px;
  padding: 7px 9px;
  font-size: 13px;
  color: var(--p-text-color);
  outline: none;
}
.value-prompt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
.value-prompt-actions button {
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}
.value-prompt-cancel {
  background: transparent;
  color: var(--p-text-color);
}
.value-prompt-cancel:hover {
  background: var(--selection-bg);
}
.value-prompt-ok {
  background: var(--p-text-color);
  color: var(--editor-bg);
  font-weight: 600;
}
.value-prompt-actions-spacer {
  flex: 1;
}
.value-prompt-remove {
  background: transparent;
  color: #e5484d;
}
.value-prompt-image-source {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.value-prompt-browse {
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
.value-prompt-browse:hover {
  background: var(--selection-bg);
}
.value-prompt-browse :deep(svg) {
  font-size: 14px;
}
.value-prompt-or {
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.value-prompt-image-preview {
  position: relative;
  margin-top: 10px;
  border: 1px solid var(--p-content-border-color);
  border-radius: 7px;
  background: var(--search-bg);
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.value-prompt-image-preview.is-empty {
  border-style: dashed;
  border-width: 2px;
}
.value-prompt-image-preview.is-drag-over {
  border-color: var(--p-text-color);
  background: var(--selection-bg);
}
.value-prompt-image-preview.is-cropping {
  cursor: crosshair;
  user-select: none;
}
.value-prompt-image-preview img {
  max-width: 100%;
  max-height: 320px;
  display: block;
}
.value-prompt-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--p-text-muted-color);
  font-size: 13px;
  pointer-events: none;
}
.value-prompt-image-placeholder :deep(svg) {
  font-size: 32px;
  opacity: 0.6;
}
.value-prompt-crop-box {
  position: absolute;
  border: 1.5px dashed #fff;
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 0 0 2000px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}
.value-prompt-image-error {
  padding: 16px;
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.value-prompt-image-error-inline {
  padding: 8px 0 0;
  color: #e5484d;
}
.value-prompt-image-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.value-prompt-image-tools button {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--p-content-border-color);
  background: transparent;
  color: var(--p-text-color);
  cursor: pointer;
  font-size: 12px;
  padding: 5px 9px;
  border-radius: 6px;
}
.value-prompt-image-tools button:hover {
  background: var(--selection-bg);
}
.value-prompt-image-tools button:disabled {
  opacity: 0.5;
  cursor: default;
}
.value-prompt-image-tools :deep(svg) {
  font-size: 14px;
}
.value-prompt-tools-sep {
  width: 1px;
  align-self: stretch;
  background: var(--p-content-border-color);
  margin: 0 2px;
}
.value-prompt-tools-label {
  font-size: 12px;
  color: var(--p-text-muted-color);
}
.value-prompt-remove:hover {
  background: rgba(229, 72, 77, 0.14);
}

.quill-editor :deep(.ql-container) {
  border: none;
  flex: 1;
  overflow-y: auto;
  font-family: inherit;
  font-size: 15px;
}

.quill-editor :deep(.ql-editor) {
  padding: 22px 24px 40px;
  line-height: 1.6;
}

.quill-editor :deep(.ql-editor.ql-blank::before) {
  color: var(--p-text-muted-color);
  font-style: normal;
  left: 24px;
}

.quill-editor :deep(.ql-editor code) {
  background: var(--search-bg);
  color: var(--p-text-color);
  border-radius: 4px;
  padding: 1px 5px;
}

/* Il default di Quill usa un bordo #000 fisso: non va bene sul tema scuro */
.quill-editor :deep(.ql-editor table td) {
  border-color: var(--p-content-border-color);
  min-width: 60px;
}

/* Spazio unificatore usato per preservare TAB/indentazione nel testo importato
   da Markdown (vedi wrapNbspInMonospace in utils/markdown.js): va reso in un
   font monospace altrimenti la sua larghezza varierebbe col font proporzionale. */
.quill-editor :deep(.ql-editor .ql-font-monospace) {
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, monospace;
  font-size: 13px;
}

.quill-editor :deep(.ql-editor .ql-code-block-container) {
  background: var(--search-bg);
  color: var(--p-text-color);
  border-radius: 8px;
  padding: 10px 14px;
}

/* syntax highlighting dei blocchi di codice (modulo Syntax di Quill + highlight.js),
   mappato sulle stesse CSS variables del raw editor per coerenza chiaro/scuro */
.quill-editor :deep(.ql-code-block-container .hljs-keyword),
.quill-editor :deep(.ql-code-block-container .hljs-selector-tag),
.quill-editor :deep(.ql-code-block-container .hljs-built_in),
.quill-editor :deep(.ql-code-block-container .hljs-meta .hljs-keyword) {
  color: var(--cm-keyword);
}
.quill-editor :deep(.ql-code-block-container .hljs-string),
.quill-editor :deep(.ql-code-block-container .hljs-regexp),
.quill-editor :deep(.ql-code-block-container .hljs-template-string),
.quill-editor :deep(.ql-code-block-container .hljs-symbol) {
  color: var(--cm-string);
}
.quill-editor :deep(.ql-code-block-container .hljs-number),
.quill-editor :deep(.ql-code-block-container .hljs-literal) {
  color: var(--cm-number);
}
.quill-editor :deep(.ql-code-block-container .hljs-comment),
.quill-editor :deep(.ql-code-block-container .hljs-quote) {
  color: var(--cm-comment);
  font-style: italic;
}
.quill-editor :deep(.ql-code-block-container .hljs-title),
.quill-editor :deep(.ql-code-block-container .hljs-title.function_),
.quill-editor :deep(.ql-code-block-container .hljs-section) {
  color: var(--cm-function);
}
.quill-editor :deep(.ql-code-block-container .hljs-type),
.quill-editor :deep(.ql-code-block-container .hljs-title.class_),
.quill-editor :deep(.ql-code-block-container .hljs-class .hljs-title) {
  color: var(--cm-type);
}
.quill-editor :deep(.ql-code-block-container .hljs-attr),
.quill-editor :deep(.ql-code-block-container .hljs-attribute),
.quill-editor :deep(.ql-code-block-container .hljs-property) {
  color: var(--cm-property);
}
.quill-editor :deep(.ql-code-block-container .hljs-variable),
.quill-editor :deep(.ql-code-block-container .hljs-params) {
  color: var(--cm-text);
}
.quill-editor :deep(.ql-code-block-container .hljs-punctuation),
.quill-editor :deep(.ql-code-block-container .hljs-operator) {
  color: var(--cm-punct);
}
/* Selettore lingua che il modulo Syntax aggiunge a ogni blocco: è un <select>
   nativo, qui spogliato del chrome di sistema (appearance:none + freccia SVG
   propria) per farlo somigliare a un chip dell'app invece che a un controllo
   del sistema operativo. */
.quill-editor :deep(.ql-code-block-container .ql-ui) {
  top: 6px;
  right: 6px;
  appearance: none;
  -webkit-appearance: none;
  border: none;
  background-color: transparent;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%239a9a9a' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 4px center;
  background-size: 11px;
  color: var(--p-text-muted-color);
  font-size: 12px;
  font-family: inherit;
  border-radius: 6px;
  padding: 3px 20px 3px 6px;
  cursor: pointer;
}
.quill-editor :deep(.ql-code-block-container .ql-ui:hover) {
  color: var(--p-text-color);
}
.quill-editor :deep(.ql-code-block-container .ql-ui:focus) {
  outline: none;
}
.quill-editor :deep(.ql-code-block-container .ql-ui option) {
  background: var(--card-bg);
  color: var(--p-text-color);
}

/* Overlay del color picker (vedi Teleport in fondo al template). position
   qui è "fixed" perché arriva da colorPickerPos, calcolata al click contro
   le coordinate della finestra — coerente col fatto che l'elemento è
   teletrasportato fuori da qualunque contenitore posizionato. */
.color-picker-overlay {
  position: fixed;
  z-index: 1000;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  border-radius: 10px;
  overflow: hidden;
}
</style>
