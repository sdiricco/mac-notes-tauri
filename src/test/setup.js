// jsdom non implementa matchMedia (usata dallo store settings per il tema di
// sistema) e ovviamente non c'e' il runtime Tauri: entrambi vengono sostituiti
// con innocui stub cosi' gli store si possono istanziare nei test.
import { vi } from 'vitest'

window.matchMedia =
  window.matchMedia ||
  (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(() => Promise.resolve()) }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(() => Promise.resolve(() => {})) }))
