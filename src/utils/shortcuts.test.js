import { describe, it, expect, vi, beforeEach } from 'vitest'

// isMac viene calcolato all'import: per provare entrambi i rami il modulo va
// ricaricato dopo aver cambiato navigator.platform.
async function loadWithPlatform(platform) {
  vi.resetModules()
  Object.defineProperty(window.navigator, 'platform', { value: platform, configurable: true })
  return import('./shortcuts')
}

describe('shortcut', () => {
  beforeEach(() => vi.resetModules())

  it('su macOS usa i simboli nell ordine ⌥⇧⌘ qualunque sia l ordine dato', async () => {
    const { shortcut, isMac } = await loadWithPlatform('MacIntel')
    expect(isMac).toBe(true)
    expect(shortcut('mod+F')).toBe('⌘F')
    expect(shortcut('shift+mod+F')).toBe('⇧⌘F')
    expect(shortcut('mod+alt+shift+X')).toBe('⌥⇧⌘X')
  })

  it('altrove usa Ctrl/Alt/Shift con il piu', async () => {
    const { shortcut, isMac } = await loadWithPlatform('Win32')
    expect(isMac).toBe(false)
    expect(shortcut('mod+F')).toBe('Ctrl+F')
    expect(shortcut('mod+shift+F')).toBe('Ctrl+Shift+F')
  })
})
