import { describe, it, expect } from 'vitest'
import { i18n, LOCALES, SUPPORTED_LOCALES, FALLBACK_LOCALE, resolveLocale } from './index'

// Le traduzioni sono dati, non codice: nulla le controlla a compile time. Questo
// test fa da typecheck: ogni lingua ha esattamente le chiavi dell'inglese, con
// lo stesso numero di forme plurali e gli stessi segnaposto. Una chiave
// dimenticata mostrerebbe l'inglese in silenzio (fallback); un segnaposto
// storpiato mostrerebbe "{nome}" letterale all'utente.
const flat = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? flat(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]
  )

const messages = i18n.global.messages.value
const en = Object.fromEntries(flat(messages.en))
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
const forms = (s) => String(s).split(' | ').length

describe('i18n', () => {
  it('ogni lingua supportata ha i suoi messaggi e un nome nativo', () => {
    for (const code of SUPPORTED_LOCALES) {
      expect(messages[code], code).toBeDefined()
      expect(LOCALES.find((l) => l.code === code)?.name, code).toBeTruthy()
    }
    expect(SUPPORTED_LOCALES).toContain(FALLBACK_LOCALE)
  })

  for (const code of SUPPORTED_LOCALES.filter((c) => c !== 'en')) {
    describe(code, () => {
      const loc = Object.fromEntries(flat(messages[code]))

      it('ha esattamente le chiavi dell inglese', () => {
        const missing = Object.keys(en).filter((k) => !(k in loc))
        const extra = Object.keys(loc).filter((k) => !(k in en))
        expect(missing, 'mancanti').toEqual([])
        expect(extra, 'in piu').toEqual([])
      })

      it('nessun valore vuoto', () => {
        const empty = Object.entries(loc).filter(([, v]) => String(v).trim() === '')
        expect(empty).toEqual([])
      })

      it('stesse forme plurali e stessi segnaposto dell inglese', () => {
        const bad = Object.keys(en)
          .filter((k) => k in loc)
          .filter(
            (k) =>
              forms(en[k]) !== forms(loc[k]) ||
              JSON.stringify(placeholders(en[k])) !== JSON.stringify(placeholders(loc[k]))
          )
        expect(bad).toEqual([])
      })
    })
  }

  it('resolveLocale accetta i codici supportati e ripiega sull inglese', () => {
    expect(resolveLocale('it')).toBe('it')
    expect(resolveLocale('ja')).toBe('ja')
    Object.defineProperty(window.navigator, 'language', { value: 'pt-BR', configurable: true })
    expect(resolveLocale('system')).toBe('pt')
    Object.defineProperty(window.navigator, 'language', { value: 'ko-KR', configurable: true })
    expect(resolveLocale('system')).toBe('en')
    expect(resolveLocale('xx')).toBe('en')
  })
})
