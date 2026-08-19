import { marked } from 'marked'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

marked.setOptions({ breaks: true, gfm: true })

// alias comuni dei fence → nomi canonici di highlight.js (usati come data-language
// e come chiavi del modulo Syntax di Quill; vedi CODE_LANGUAGES in QuillEditor.vue)
const LANG_ALIASES = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  html: 'xml',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  rb: 'ruby',
  rs: 'rust',
  md: 'markdown',
  golang: 'go'
}
export function normalizeLang(lang) {
  const key = (lang || '').trim().toLowerCase()
  return LANG_ALIASES[key] || key || 'plain'
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
})
turndownService.use(gfm)

// Quill usa <ol> per tutte le liste, distinguendo il tipo con data-list
turndownService.addRule('quillListItem', {
  filter: (node) => node.nodeName === 'LI' && node.getAttribute('data-list'),
  replacement: (content, node) => {
    const type = node.getAttribute('data-list')
    const body = content
      .replace(/^\n+/, '')
      .replace(/\n+$/, '\n')
      .replace(/\n/gm, '\n    ')
    let prefix = '- '
    if (type === 'ordered') {
      const index = Array.prototype.indexOf.call(node.parentNode.children, node) + 1
      prefix = `${index}. `
    } else if (type === 'checked') {
      prefix = '- [x] '
    } else if (type === 'unchecked') {
      prefix = '- [ ] '
    }
    return prefix + body + (node.nextSibling && !/\n$/.test(body) ? '\n' : '')
  }
})

// Il formato nativo di Quill per un blocco di codice (con il modulo Syntax attivo)
// è <pre data-language="xx">codice</pre>: turndown per default lo tratterebbe come
// <pre> generico (fence senza linguaggio), quindi leggiamo noi l'attributo.
turndownService.addRule('quillCodeBlock', {
  filter: (node) => node.nodeName === 'PRE',
  replacement: (_content, node) => {
    const lang = node.getAttribute('data-language')
    const fence = lang && lang !== 'plain' ? lang : ''
    const code = node.textContent.replace(/^\n/, '').replace(/\n$/, '')
    return '\n```' + fence + '\n' + code + '\n```\n\n'
  }
})

// Le tabelle di Quill non hanno <thead>/<th> (ogni cella è un <td>, anche
// nella prima riga): la regola tabella di turndown-plugin-gfm richiede una
// heading row di soli <th> per convertire, altrimenti lascia l'HTML grezzo
// intatto (```<table>```). Costruiamo quindi noi il markdown, trattando
// sempre la prima riga come intestazione.
turndownService.addRule('quillTable', {
  filter: (node) => node.nodeName === 'TABLE',
  replacement: (_content, node) => {
    const rows = Array.from(node.rows).map((row) =>
      Array.from(row.cells).map((cell) => cell.textContent.trim().replace(/\|/g, '\\|') || ' ')
    )
    if (!rows.length) return ''
    const toLine = (cells) => `| ${cells.join(' | ')} |`
    const [header, ...body] = rows
    const divider = toLine(header.map(() => '---'))
    return '\n\n' + [toLine(header), divider, ...body.map(toLine)].join('\n') + '\n\n'
  }
})

// Elementi di UI interni a Quill (frecce delle checklist, selettore lingua ecc.)
turndownService.addRule('quillUi', {
  filter: (node) => node.nodeName === 'SPAN' && node.classList?.contains('ql-ui'),
  replacement: () => ''
})

// Spazio unificatore (U+00A0): non viene collassato da HTML/browser, e i parser
// Markdown non lo trattano come lo spazio ASCII che innesca liste annidate o
// blocchi di codice indentati.
const NBSP = String.fromCharCode(0xa0)
const SENT = String.fromCharCode(0) // sentinella per proteggere i blocchi fenced

// Una riga è "strutturale" se la sua indentazione ha un significato per il parser
// Markdown (elenco, citazione, titolo): in questi casi lo spazio iniziale NON va
// toccato, altrimenti si rompe il riconoscimento di liste annidate ecc.
const LIST_RE = /^\s*([-*+]|\d+[.)])\s/
const BLOCKQUOTE_RE = /^\s*>/
const HEADING_RE = /^\s*#{1,6}\s/
const isStructuralLine = (line) => LIST_RE.test(line) || BLOCKQUOTE_RE.test(line) || HEADING_RE.test(line)

// Un TAB non è largo "N spazi fissi" ma avanza fino al prossimo multiplo di
// TAB_SIZE colonne, quindi il suo spazio effettivo dipende da dove si trova
// nella riga: serve per i TAB letterali che arrivano da un file .md importato.
const TAB_SIZE = 2

// Trasforma la spaziatura "decorativa" di una riga (non strutturale) preservando
// la semantica dei tab-stop: la colonna corrente viene tracciata carattere per
// carattere così un TAB a metà riga si espande solo fino al prossimo tab-stop,
// non sempre a 4 spazi fissi.
function expandLineWhitespace(text, startCol) {
  let out = ''
  let col = startCol
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\t') {
      const width = TAB_SIZE - (col % TAB_SIZE)
      out += NBSP.repeat(width)
      col += width
    } else if (ch === ' ') {
      let j = i
      while (j < text.length && text[j] === ' ') j++
      const runLen = j - i
      // Un singolo spazio resta normale (permette l'a-capo). Un run di 2+ va
      // preservato PER INTERO come spazio unificatore: se anche un solo carattere
      // del run restasse uno spazio normale, quel carattere renderebbe nel font
      // proporzionale del testo (più stretto) invece che nel monospace applicato
      // dopo (vedi wrapNbspInMonospace), rompendo la corrispondenza di larghezza
      // col raw anche per un run di sole 2 spazi.
      out += runLen >= 2 ? NBSP.repeat(runLen) : ' '
      col += runLen
      i = j - 1
    } else {
      out += ch
      col += 1
    }
  }
  return out
}

// Preserva la spaziatura "decorativa" (indentazione di paragrafi non in lista,
// allineamenti con più spazi) che altrimenti l'HTML collasserebbe o che innescherebbe
// la regola Markdown "4 spazi = blocco di codice". Non tocca l'indentazione di righe
// strutturali (liste, citazioni, titoli) per non comprometterne il parsing, né i
// blocchi fenced ```…``` (protetti a parte, dove la spaziatura serve al codice).
function preserveWhitespace(markdown) {
  const fences = []
  const guarded = markdown.replace(/```[\s\S]*?(?:```|$)/g, (m) => {
    fences.push(m)
    return `${SENT}${fences.length - 1}${SENT}`
  })

  const lines = guarded.split('\n').map((line) => {
    const leadMatch = line.match(/^[ \t]+/)
    const lead = leadMatch ? leadMatch[0] : ''
    const rest = line.slice(lead.length)
    const structural = isStructuralLine(line)

    // Riga strutturale: il lead resta intatto per il parser; la colonna di
    // partenza per il resto della riga è comunque la sua lunghezza (i tab nel
    // lead di una riga strutturale sono un caso raro, non ottimizzato qui).
    const newLead = !structural && lead ? expandLineWhitespace(lead, 0) : lead
    const startCol = structural ? lead.length : newLead.length
    const newRest = expandLineWhitespace(rest, startCol)
    return newLead + newRest
  })

  return lines.join('\n').replace(new RegExp(`${SENT}(\\d+)${SENT}`, 'g'), (_m, i) => fences[Number(i)])
}

// Al ritorno da HTML, ogni NBSP diventa uno spazio normale: non proviamo a
// distinguere se in origine fosse un TAB o più spazi, ci basta che la spaziatura
// visiva non collassi più.
function nbspToPlain(markdown) {
  return markdown.replace(new RegExp(NBSP, 'g'), ' ')
}

// Avvolge i run di spazio unificatore in uno span monospace, per far coincidere
// la larghezza visiva dell'indentazione con quella del raw (CodeMirror è monospace,
// mentre il testo normale in anteprima usa un font proporzionale: a parità di
// caratteri il TAB "varrebbe" una larghezza diversa tra le due modalità).
// Nota: il valore DEVE essere letteralmente "monospace" (o "serif") — il format
// 'font' di Quill ha una whitelist fissa e scarta in paste qualunque altro valore
// di font-family, incluso uno stack tipo "'SF Mono', ui-monospace, …".
function wrapNbspInMonospace(html) {
  return html.replace(
    new RegExp(`${NBSP}+`, 'g'),
    (run) => `<span style="font-family: monospace">${run}</span>`
  )
}

// Il formato nativo di Quill per le tabelle è piatto (<tbody><tr><td data-row="…">,
// nessun <thead>/<th>): il paste di Quill non ha un matcher dedicato per le tabelle,
// quindi una <table> "normale" generata da marked (con <thead>/<th>) non viene
// riconosciuta e finisce spezzata in più tabelle da una riga. Ricostruiamo qui la
// tabella nel formato che Quill si aspetta, appiattendo intestazione e corpo.
function normalizeTablesForQuill(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('table').forEach((table) => {
    const tbody = doc.createElement('tbody')
    Array.from(table.rows).forEach((row) => {
      const rowId = `row-${Math.random().toString(36).slice(2, 6)}`
      const tr = doc.createElement('tr')
      Array.from(row.cells).forEach((cell) => {
        const td = doc.createElement('td')
        td.setAttribute('data-row', rowId)
        td.innerHTML = cell.innerHTML.trim() || '<br>'
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    const newTable = doc.createElement('table')
    newTable.appendChild(tbody)
    table.replaceWith(newTable)
  })
  return doc.body.innerHTML
}

export function markdownToHtml(markdown) {
  let html = marked.parse(preserveWhitespace(markdown || ''))
  html = wrapNbspInMonospace(html)
  // le task list di marked (<input type="checkbox">) diventano checklist native di Quill
  html = html.replace(/<li>\s*<input([^>]*type="checkbox"[^>]*)>\s*/g, (_m, attrs) => {
    const state = /\bchecked\b/.test(attrs) ? 'checked' : 'unchecked'
    return `<li data-list="${state}">`
  })
  // blocchi di codice di marked (<pre><code class="language-xx">) → formato nativo
  // di Quill col modulo Syntax attivo: <pre data-language="xx">, che il paste di
  // Quill riconosce da solo (matchCodeBlock legge data-language dal <pre>) e
  // colora subito con highlight.js, senza bisogno di post-processing via API.
  html = html.replace(
    /<pre><code(?:\s+class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>\s*/g,
    (_m, lang, code) => `<pre data-language="${normalizeLang(lang)}">\n${code.replace(/\n$/, '')}\n</pre>`
  )
  html = normalizeTablesForQuill(html)
  return html
}

export function htmlToMarkdown(html) {
  return nbspToPlain(turndownService.turndown(html || ''))
}

export function stripHtml(html) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Il titolo non si digita più a mano: si deduce dal primo h1/h2/h3 presente
// nel contenuto. Se non c'è alcun titolo nel testo, resta vuoto.
export function extractTitleFromHtml(html) {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const heading = doc.querySelector('h1, h2, h3')
  return heading ? heading.textContent.trim() : ''
}
