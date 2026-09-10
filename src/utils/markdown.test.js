import { describe, it, expect } from 'vitest'
import {
  normalizeLang,
  htmlToMarkdown,
  markdownToHtml,
  stripHtml,
  extractTitleFromHtml
} from './markdown'

describe('normalizeLang', () => {
  it('risolve gli alias comuni sui nomi di highlight.js', () => {
    expect(normalizeLang('js')).toBe('javascript')
    expect(normalizeLang(' TS ')).toBe('typescript')
    expect(normalizeLang('rs')).toBe('rust')
    expect(normalizeLang('html')).toBe('xml')
  })
  it('lascia passare i nomi sconosciuti e usa plain se vuoto', () => {
    expect(normalizeLang('elixir')).toBe('elixir')
    expect(normalizeLang('')).toBe('plain')
    expect(normalizeLang(undefined)).toBe('plain')
  })
})

describe('htmlToMarkdown', () => {
  it('converte titoli e testo in atx markdown', () => {
    expect(htmlToMarkdown('<h1>Titolo</h1><p>Ciao <strong>mondo</strong></p>')).toBe(
      '# Titolo\n\nCiao **mondo**'
    )
  })
  it('capisce le liste di Quill (ol con data-list)', () => {
    const html =
      '<ol><li data-list="bullet">uno</li><li data-list="bullet">due</li></ol>' +
      '<ol><li data-list="ordered">a</li><li data-list="ordered">b</li></ol>' +
      '<ol><li data-list="checked">fatto</li><li data-list="unchecked">da fare</li></ol>'
    const md = htmlToMarkdown(html)
    expect(md).toContain('- uno\n- due')
    expect(md).toContain('1. a\n2. b')
    expect(md).toContain('- [x] fatto\n- [ ] da fare')
  })
  it('accetta input vuoto', () => {
    expect(htmlToMarkdown('')).toBe('')
    expect(htmlToMarkdown(undefined)).toBe('')
  })
})

describe('markdownToHtml', () => {
  it('trasforma le task list nel formato checklist di Quill', () => {
    const html = markdownToHtml('- [x] fatto\n- [ ] da fare')
    expect(html).toContain('<li data-list="checked">')
    expect(html).toContain('<li data-list="unchecked">')
    expect(html).not.toContain('type="checkbox"')
  })
  it('trasforma i fence in pre data-language con lingua normalizzata', () => {
    const html = markdownToHtml('```js\nconst a = 1\n```')
    expect(html).toContain('<pre data-language="javascript">')
    expect(html).toContain('const a = 1')
  })
})

describe('stripHtml', () => {
  it('separa i blocchi con uno spazio e decodifica le entita', () => {
    expect(stripHtml('<p>primo</p><p>secondo</p>')).toBe('primo secondo')
    expect(stripHtml('<p>l&#39;altro&nbsp;&quot;x&quot;</p>')).toBe('l\'altro "x"')
  })
  it('ritorna stringa vuota senza input', () => {
    expect(stripHtml('')).toBe('')
    expect(stripHtml(null)).toBe('')
  })
})

describe('extractTitleFromHtml', () => {
  it('usa il primo h1/h2/h3, non il primo paragrafo', () => {
    expect(extractTitleFromHtml('<p>intro</p><h2> Il titolo </h2><h1>altro</h1>')).toBe(
      'Il titolo'
    )
  })
  it('vuoto se non ci sono titoli', () => {
    expect(extractTitleFromHtml('<p>solo testo</p>')).toBe('')
    expect(extractTitleFromHtml('')).toBe('')
  })
})
