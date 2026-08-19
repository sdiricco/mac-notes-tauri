<template>
  <section class="note-editor">
    <div class="editor-drag"></div>

    <div v-if="!store.selectedNote" class="empty-state">
      <Icon icon="lucide:notebook-pen" />
      <p>Seleziona una nota o creane una nuova</p>
    </div>

    <template v-else>
      <div class="editor-header">
        <!-- Toolbar di formattazione di Quill: montata qui (contenitore esterno,
             vedi toolbar-container su QuillEditor) per stare sopra ai pulsanti
             azione invece che nella posizione di default. -->
        <div ref="quillToolbarEl" class="floating-toolbar"></div>

        <!-- Azioni sempre visibili: cerca, preferiti, cestino. Il resto (poco
             usato) sta nel menu overflow "⋮" invece di affollare la pillola,
             così l'header non deve mai andare a capo. -->
        <div class="action-card">
          <button class="icon-btn" title="Cerca nella nota (⌘F)" @click="quillEditorRef?.toggleFindBar()">
            <Icon icon="lucide:search" />
          </button>
          <button
            class="icon-btn"
            :title="store.selectedNote.pinned ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'"
            @click="store.togglePin(store.selectedNote.id)"
          >
            <Icon icon="lucide:star" :class="{ filled: store.selectedNote.pinned }" />
          </button>
          <button
            v-if="!store.selectedNote.trashed"
            class="icon-btn"
            title="Sposta nel cestino"
            @click="confirmTrash"
          >
            <Icon icon="lucide:trash-2" />
          </button>
          <button v-else class="icon-btn" title="Ripristina" @click="store.restoreNote(store.selectedNote.id)">
            <Icon icon="lucide:rotate-ccw" />
          </button>

          <div ref="actionOverflowEl" class="action-overflow">
            <button class="icon-btn" title="Altre azioni" @click="actionMenuOpen = !actionMenuOpen">
              <Icon icon="lucide:more-vertical" />
            </button>
            <div v-if="actionMenuOpen" class="action-overflow-menu">
              <button @click="importNote(); actionMenuOpen = false">
                <Icon icon="lucide:upload" />
                <span>Importa Markdown</span>
              </button>
              <button @click="openMarkdownPreview(); actionMenuOpen = false">
                <Icon icon="lucide:file-code" />
                <span>Markdown...</span>
              </button>
              <button @click="settings.toggleSpellcheck()">
                <Icon icon="lucide:spell-check" />
                <span>Ortografia: {{ settings.spellcheck ? 'attiva' : 'disattiva' }}</span>
              </button>
              <button @click="api.revealDataFile(); actionMenuOpen = false">
                <Icon icon="lucide:folder-open" />
                <span>Mostra nel Finder</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <QuillEditor
        ref="quillEditorRef"
        :key="`${store.selectedNote.id}-${reloadCounter}-${settings.toolbarMode}`"
        :note-id="store.selectedNote.id"
        :content="store.selectedNote.content"
        :toolbar-container="quillToolbarEl"
        :toolbar-mode="settings.toolbarMode"
        class="editor-body"
        @change="onContentChange"
      />

      <Dialog
        v-model:visible="markdownPreviewOpen"
        modal
        header="Markdown"
        :style="{ width: '38rem' }"
        :draggable="false"
        dismissable-mask
      >
        <pre class="markdown-preview">{{ markdownPreviewText }}</pre>
        <template #footer>
          <button class="md-action-btn" @click="copyNote">
            <Icon icon="lucide:copy" />
            <span>Copia</span>
          </button>
          <button class="md-action-btn primary" @click="exportNote">
            <Icon icon="lucide:download" />
            <span>Scarica</span>
          </button>
        </template>
      </Dialog>
    </template>
  </section>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import { Icon } from '@iconify/vue'
import { useNotesStore } from '../stores/notes'
import { useSettingsStore } from '../stores/settings'
import QuillEditor from './QuillEditor.vue'
import { htmlToMarkdown, markdownToHtml } from '../utils/markdown'
import { api } from '../utils/api'

const store = useNotesStore()
const settings = useSettingsStore()
const toast = useToast()
const confirm = useConfirm()

const quillToolbarEl = ref(null)
const quillEditorRef = ref(null)
// L'import sostituisce il contenuto della nota già aperta: QuillEditor lo ricarica
// solo quando cambia il suo :key (osserva solo noteId, non il content prop), quindi
// serve forzare un remount incrementando questo contatore.
const reloadCounter = ref(0)

const markdownPreviewOpen = ref(false)
const markdownPreviewText = ref('')

// Menu overflow "⋮" delle azioni meno usate (importa, markdown, ortografia,
// Finder): chiuso automaticamente al click fuori, stesso pattern del menu
// contestuale tabella in QuillEditor.vue.
const actionMenuOpen = ref(false)
const actionOverflowEl = ref(null)

function onGlobalMousedown(event) {
  if (actionMenuOpen.value && actionOverflowEl.value && !actionOverflowEl.value.contains(event.target)) {
    actionMenuOpen.value = false
  }
}

onMounted(() => window.addEventListener('mousedown', onGlobalMousedown))
onBeforeUnmount(() => window.removeEventListener('mousedown', onGlobalMousedown))

function openMarkdownPreview() {
  markdownPreviewText.value = htmlToMarkdown(store.selectedNote.content)
  markdownPreviewOpen.value = true
}

function confirmTrash() {
  const title = store.selectedNote.title?.trim() || 'Nuova nota'
  confirm.require({
    message: `Vuoi spostare la nota "${title}" nel cestino?`,
    header: 'Sposta nel cestino',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Sposta',
    rejectLabel: 'Annulla',
    acceptClass: 'p-button-danger',
    rejectClass: 'p-button-secondary',
    accept: () => store.trashNote(store.selectedNote.id)
  })
}

function onContentChange(html) {
  store.updateNote(store.selectedNote.id, { content: html })
}

function suggestedFileName() {
  const title = store.selectedNote.title?.trim()
  return title ? title.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) : 'nota'
}

async function exportNote() {
  const markdown = htmlToMarkdown(store.selectedNote.content)
  const result = await api.exportMarkdown(markdown, suggestedFileName())
  if (result) toast.add({ severity: 'success', summary: 'Nota esportata come Markdown', life: 1800 })
}

async function importNote() {
  const result = await api.importMarkdown()
  if (!result) return
  store.updateNote(store.selectedNote.id, { content: markdownToHtml(result.markdown) })
  reloadCounter.value++
  toast.add({ severity: 'success', summary: 'Markdown importato nella nota', life: 1800 })
}

async function copyNote() {
  await navigator.clipboard.writeText(htmlToMarkdown(store.selectedNote.content))
  toast.add({ severity: 'success', summary: 'Copiato come Markdown', life: 1800 })
}
</script>

<style scoped>
.note-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--editor-bg);
}

/* Nessuna altezza fissa: era una striscia draggabile duplicata, la stessa
   funzione la assolve già editor-header (anch'esso -webkit-app-region:drag).
   Lo spazio che dava è confluito nel padding-top dell'header, vedi sotto. */
.editor-drag {
  -webkit-app-region: drag;
  flex-shrink: 0;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--p-text-muted-color);
  gap: 8px;
}
.empty-state :deep(svg) {
  font-size: 30px;
}

/* Barra unica a tutta larghezza (non più due pillole separate): la toolbar
   di formattazione (uso frequente) sta a sinistra, le azioni sulla nota (uso
   saltuario) a destra, con un bordo inferiore che separa dal contenuto,
   come una vera toolbar d'app invece di due card fluttuanti. Ogni gruppo
   nasconde i controlli meno usati in un proprio menu overflow (vedi
   .toolbar-overflow-panel e .action-overflow-menu) invece di andare a capo,
   così l'altezza dell'header resta costante a qualunque larghezza. */
.editor-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  -webkit-app-region: drag;
  background: transparent;
  border-bottom: 1px solid var(--p-content-border-color);
}

.action-card {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.action-overflow {
  position: relative;
  display: flex;
}

.action-overflow-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  min-width: 210px;
  background: var(--editor-toolbar-bg);
  border: 1px solid var(--p-content-border-color);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.action-overflow-menu button {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--p-text-color);
  cursor: pointer;
  font-size: 13px;
  padding: 7px 10px;
  border-radius: 6px;
  text-align: left;
  outline: none;
}
.action-overflow-menu button:hover {
  background: var(--sidebar-hover-bg);
}
.action-overflow-menu :deep(svg) {
  font-size: 15px;
  color: var(--icon-color);
  flex-shrink: 0;
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
  -webkit-app-region: no-drag;
}
.icon-btn:hover {
  background: var(--sidebar-hover-bg);
  color: var(--p-text-color);
}
.icon-btn.on {
  background: var(--selection-bg);
  color: var(--p-text-color);
}
/* lucide:star ha fill="none" sul <path> stesso (non sull'<svg> genitore):
   l'eredità CSS non può vincere sopra un attributo diretto del figlio,
   quindi va sovrascritto puntando esplicitamente il path. */
.icon-btn :deep(svg.filled) {
  color: var(--p-text-color);
}
.icon-btn :deep(svg.filled path) {
  fill: var(--p-text-color);
}

.editor-body {
  flex: 1;
  min-height: 0;
}

.markdown-preview {
  max-height: 60vh;
  overflow: auto;
  margin: 0;
  padding: 12px 14px;
  background: var(--search-bg);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  font-family: 'SF Mono', ui-monospace, Menlo, Monaco, monospace;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--p-text-color);
  white-space: pre-wrap;
  word-break: break-word;
}

.md-action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--p-content-border-color);
  background: transparent;
  color: var(--p-text-color);
  cursor: pointer;
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 7px;
}
.md-action-btn:hover {
  background: var(--sidebar-hover-bg);
}
.md-action-btn.primary {
  background: var(--p-text-color);
  color: var(--editor-bg);
  border-color: transparent;
  font-weight: 600;
}
.md-action-btn.primary:hover {
  opacity: 0.9;
}
.md-action-btn :deep(svg) {
  font-size: 14px;
}

/* ---- Toolbar di formattazione e azioni sulla nota: due gruppi allo stesso
   livello della barra unica (niente più sfondo/bordo/ombra propri, li eredita
   dalla barra), larghi solo quanto il loro contenuto e allineati agli estremi
   dell'header. Il contenuto della toolbar (bottoni/select) è iniettato da
   Quill in modo imperativo: serve :deep() perché non fa parte del template
   compilato di questo componente. ---- */
.floating-toolbar,
.action-card {
  width: fit-content;
  max-width: 100%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  -webkit-app-region: no-drag;
}

/* Quill aggiunge le classi ql-toolbar/ql-snow al contenitore esterno passato
   come modules.toolbar.container: quill.snow.css le usa per un bordo/padding
   di default (border 1px + padding 8px) più specifico del nostro selettore a
   singola classe, che quindi va forzato per non far ricomparire quel box. */
.floating-toolbar {
  border: none !important;
  padding: 0 !important;
  background: transparent !important;
  /* NIENTE overflow-x:auto qui: per spec CSS, un overflow-x diverso da
     "visible" forza anche overflow-y a comportarsi come "auto" sullo stesso
     elemento, e questo contenitore ospita i menu a discesa/pannello overflow
     di Quill (position:absolute) — verrebbero ritagliati e risulterebbero
     "apribili" nel DOM (classe ql-expanded, dimensioni corrette) ma invisibili
     a schermo. In modalità estesa a finestra stretta i controlli restano
     quindi semplicemente su una riga che eccede, senza scroll dedicato.
     min-width:0 evita solo che il flex item forzi la finestra a slargarsi. */
  min-width: 0;
}

.floating-toolbar :deep(.ql-formats) {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  margin-right: 4px;
  padding-right: 4px;
  border-right: 1px solid var(--p-content-border-color);
}
.floating-toolbar :deep(.ql-formats:last-child) {
  border-right: none;
  margin-right: 0;
  padding-right: 0;
}

.floating-toolbar :deep(button) {
  width: 25px;
  height: 25px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: none;
  background: transparent;
  cursor: pointer;
  outline: none;
}
.floating-toolbar :deep(button:hover),
.floating-toolbar :deep(button.ql-active) {
  background: var(--selection-bg);
}

.floating-toolbar :deep(.ql-stroke) {
  stroke: var(--icon-color);
}
.floating-toolbar :deep(.ql-fill) {
  fill: var(--icon-color);
}
.floating-toolbar :deep(button:hover .ql-stroke),
.floating-toolbar :deep(button.ql-active .ql-stroke) {
  stroke: var(--p-text-color);
}
.floating-toolbar :deep(button:hover .ql-fill),
.floating-toolbar :deep(button.ql-active .ql-fill) {
  fill: var(--p-text-color);
}

.floating-toolbar :deep(.ql-picker) {
  color: var(--icon-color);
  font-size: 11px;
  height: 25px;
}
.floating-toolbar :deep(.ql-picker-label) {
  border: none;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  padding: 0 16px 0 6px;
}
.floating-toolbar :deep(.ql-picker-label:hover),
.floating-toolbar :deep(.ql-picker.ql-expanded .ql-picker-label) {
  background: var(--selection-bg);
  color: var(--p-text-color);
}

/* Etichetta del selettore di stile del blocco: mostra sempre lo stato
   attuale ("Normal" di default, "Heading 1/2/3" quando applicato), non un
   testo segnaposto fisso — si comporta come una vera select. È un chip con
   sfondo proprio, distinto dai bottoni di formattazione inline: è il primo
   controllo, quello che decide il "tipo" di paragrafo, non un toggle come
   bold/italic. Idem per il gruppo liste, che ora è un unico menu a discesa
   invece di tre bottoni separati. */
.floating-toolbar :deep(.ql-picker.ql-header) {
  width: auto;
  min-width: 92px;
}
.floating-toolbar :deep(.ql-picker.ql-header .ql-picker-label) {
  background: var(--search-bg);
}
.floating-toolbar :deep(.ql-picker.ql-header .ql-picker-label)::before,
.floating-toolbar :deep(.ql-picker.ql-header .ql-picker-item)::before {
  content: 'Normal';
}
.floating-toolbar :deep(.ql-picker.ql-header .ql-picker-label[data-value='1'])::before,
.floating-toolbar :deep(.ql-picker.ql-header .ql-picker-item[data-value='1'])::before {
  content: 'Heading 1';
}
.floating-toolbar :deep(.ql-picker.ql-header .ql-picker-label[data-value='2'])::before,
.floating-toolbar :deep(.ql-picker.ql-header .ql-picker-item[data-value='2'])::before {
  content: 'Heading 2';
}
.floating-toolbar :deep(.ql-picker.ql-header .ql-picker-label[data-value='3'])::before,
.floating-toolbar :deep(.ql-picker.ql-header .ql-picker-item[data-value='3'])::before {
  content: 'Heading 3';
}

.floating-toolbar :deep(.ql-picker.ql-list) {
  width: 78px;
}
.floating-toolbar :deep(.ql-picker.ql-list .ql-picker-label)::before {
  content: 'Lista';
}
.floating-toolbar :deep(.ql-picker.ql-list .ql-picker-label[data-value='ordered'])::before {
  content: 'Numerata';
}
.floating-toolbar :deep(.ql-picker.ql-list .ql-picker-label[data-value='bullet'])::before {
  content: 'Puntata';
}
.floating-toolbar :deep(.ql-picker.ql-list .ql-picker-label[data-value='unchecked'])::before {
  content: 'Checklist';
}

/* Nelle voci del menu (aperto) un glifo davanti al testo aiuta a distinguere
   subito il tipo di lista, invece del solo nome. */
.floating-toolbar :deep(.ql-picker.ql-list .ql-picker-item)::before {
  content: '– Lista';
}
.floating-toolbar :deep(.ql-picker.ql-list .ql-picker-item[data-value='ordered'])::before {
  content: '1. Numerata';
}
.floating-toolbar :deep(.ql-picker.ql-list .ql-picker-item[data-value='bullet'])::before {
  content: '• Puntata';
}
.floating-toolbar :deep(.ql-picker.ql-list .ql-picker-item[data-value='unchecked'])::before {
  content: '☑ Checklist';
}

/* Color/background: la label mostra l'icona del pennarello, non un testo con
   freccia a discesa, quindi serve un padding ridotto e simmetrico: col padding
   pensato per gli altri select (8px/20px) l'icona SVG finiva senza spazio
   disponibile e collassava a larghezza 0. */
.floating-toolbar :deep(.ql-color-picker .ql-picker-label),
.floating-toolbar :deep(.ql-icon-picker .ql-picker-label) {
  padding: 2px 4px;
}
.floating-toolbar :deep(.ql-picker-label:hover .ql-stroke),
.floating-toolbar :deep(.ql-picker.ql-expanded .ql-picker-label .ql-stroke) {
  stroke: var(--p-text-color);
}
.floating-toolbar :deep(.ql-picker-options) {
  background: var(--editor-bg);
  border: 1px solid var(--p-content-border-color) !important;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  padding: 4px;
  margin-top: 4px;
}
.floating-toolbar :deep(.ql-picker-item) {
  border-radius: 5px;
  padding: 3px 10px;
  color: var(--p-text-color);
}
.floating-toolbar :deep(.ql-picker-item:hover) {
  background: var(--selection-bg);
  color: var(--p-text-color);
}
.floating-toolbar :deep(.ql-picker-item.ql-selected) {
  color: var(--p-text-color);
  font-weight: 600;
}

/* Quill Snow usa #06c hardcoded su stati attivi/espansi: forziamo il neutro */
.floating-toolbar :deep(button.ql-active),
.floating-toolbar :deep(.ql-picker-label.ql-active),
.floating-toolbar :deep(.ql-picker.ql-expanded .ql-picker-label),
.floating-toolbar :deep(.ql-picker-item.ql-selected),
.floating-toolbar :deep(.ql-picker-item:hover) {
  color: var(--p-text-color) !important;
}
.floating-toolbar :deep(button.ql-active .ql-stroke),
.floating-toolbar :deep(.ql-picker-label.ql-active .ql-stroke),
.floating-toolbar :deep(.ql-picker.ql-expanded .ql-picker-label .ql-stroke),
.floating-toolbar :deep(.ql-picker-item:hover .ql-stroke) {
  stroke: var(--p-text-color) !important;
}
.floating-toolbar :deep(button.ql-active .ql-fill) {
  fill: var(--p-text-color) !important;
}

/* Mini-menu della toolbar (overflow "⋯" e, in compatta, lo stile testo sotto
   "Aa"): il bottone toggle eredita già dimensioni/hover/colore icona dalla
   regola generica ".floating-toolbar :deep(button)" sopra, quindi qui serve
   solo il posizionamento del pannello a comparsa — condiviso da entrambi,
   distinti solo dalla classe più specifica dove serve. */
.floating-toolbar :deep(.toolbar-dropdown) {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.floating-toolbar :deep(.toolbar-dropdown.is-open .toolbar-dropdown-toggle) {
  background: var(--selection-bg);
}
.floating-toolbar :deep(.toolbar-dropdown-panel) {
  display: none;
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 20;
  align-items: center;
  flex-wrap: nowrap;
  background: var(--editor-toolbar-bg);
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  padding: 3px 8px;
}
.floating-toolbar :deep(.toolbar-dropdown.is-open .toolbar-dropdown-panel) {
  display: flex;
}

/* "Aa" + le stesse doppie frecce dei picker (titolo, lista) qui accanto:
   comunica di essere un menu a comparsa, non un semplice bottone. La regola
   generica del bottone (25x25, quadrata) è troppo stretta per testo+freccia,
   va allargata come già si fa per il picker del titolo. */
.floating-toolbar :deep(.style-dropdown-toggle) {
  width: auto;
  gap: 3px;
  padding: 0 4px;
  font-size: 12px;
  font-weight: 700;
  font-style: italic;
  color: var(--icon-color);
}
/* Quill dà agli svg dentro un bottone "height:100%" (li scala all'altezza
   del bottone, 25px): fuori da un vero ".ql-picker" non c'è la regola che
   normalmente fissa la freccia a 18px, quindi qui la nostra usciva più
   grande delle due accanto. 18px, la stessa identica misura che Quill usa
   per le frecce degli altri due picker (".ql-snow .ql-picker svg { width:
   18px }"), non un valore scelto a occhio. */
.floating-toolbar :deep(.style-dropdown-toggle svg) {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.floating-toolbar :deep(.style-dropdown-toggle .ql-stroke) {
  stroke: var(--icon-color);
}
.floating-toolbar :deep(.style-dropdown.is-open .style-dropdown-toggle),
.floating-toolbar :deep(.style-dropdown-toggle:hover),
.floating-toolbar :deep(.style-dropdown-toggle.is-active) {
  color: var(--p-text-color);
}
.floating-toolbar :deep(.style-dropdown.is-open .style-dropdown-toggle .ql-stroke),
.floating-toolbar :deep(.style-dropdown-toggle:hover .ql-stroke),
.floating-toolbar :deep(.style-dropdown-toggle.is-active .ql-stroke) {
  stroke: var(--p-text-color);
}
/* Raggruppando i 5 stili sotto "Aa" si perde il segnale immediato che quill
   dà di suo ai bottoni ql-* (classe ql-active quando il formato è applicato
   alla selezione): senza, chiudendo il pannello non c'è più modo di vedere a
   colpo d'occhio se il cursore è per esempio dentro del testo in grassetto.
   is-active viene sincronizzata a mano (vedi syncStyleToggleActive in
   QuillEditor.vue) perché quill gestisce ql-active solo sui bottoni con una
   classe ql-*, non sul nostro toggle custom. */
.floating-toolbar :deep(.style-dropdown-toggle.is-active) {
  background: var(--selection-bg);
}
</style>
