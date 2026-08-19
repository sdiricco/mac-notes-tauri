// Etichette delle scorciatoie da tastiera, condivise tra i tooltip della
// toolbar (QuillEditor) e la finestra "Scorciatoie da tastiera": tenerle in un
// solo posto evita che le due liste divergano quando si aggiunge o cambia una
// combinazione.
export const isMac = navigator.platform.toLowerCase().includes('mac')

export const MOD = isMac ? '⌘' : 'Ctrl'
export const ALT = isMac ? '⌥' : 'Alt'
export const SHIFT = isMac ? '⇧' : 'Shift'

const SYMBOLS = { mod: MOD, alt: ALT, shift: SHIFT }
// Su macOS i modificatori si scrivono sempre nell'ordine ⌃⌥⇧⌘ a prescindere
// dall'ordine in cui vengono elencati nella combo passata qui.
const MAC_ORDER = ['alt', 'shift', 'mod']

/**
 * 'mod+shift+X' -> '⇧⌘X' su macOS, 'Ctrl+Shift+X' altrove.
 */
export function shortcut(combo) {
  const parts = combo.split('+')
  const key = parts.pop()
  const mods = parts.map((m) => m.toLowerCase())
  if (isMac) {
    return (
      MAC_ORDER.filter((m) => mods.includes(m))
        .map((m) => SYMBOLS[m])
        .join('') + key
    )
  }
  return [...mods.map((m) => SYMBOLS[m]), key].join('+')
}
