// Nota di benvenuto creata al primo avvio (vedi notes.js, seedFirstRun): e'
// il primo contenuto che un utente nuovo vede, quindi mostra il rich text in
// azione (titoli, elenco, checklist) e dice le poche cose da sapere. Testo
// dalle traduzioni (dominio "welcome"), HTML nel formato che Quill produce
// (liste come <ol> con data-list), cosi' si apre gia' "nativa" nell'editor.
import { t } from '../i18n'

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const list = (keys, type) =>
  `<ol>${keys.map((k) => `<li data-list="${type}">${escapeHtml(t(k))}</li>`).join('')}</ol>`

export function buildWelcomeHtml() {
  return [
    `<h1>${escapeHtml(t('welcome.title'))}</h1>`,
    `<p>${escapeHtml(t('welcome.intro'))}</p>`,
    `<h2>${escapeHtml(t('welcome.featuresTitle'))}</h2>`,
    list(['welcome.feature1', 'welcome.feature2', 'welcome.feature3', 'welcome.feature4'], 'bullet'),
    `<h2>${escapeHtml(t('welcome.tryTitle'))}</h2>`,
    list(['welcome.try1', 'welcome.try2', 'welcome.try3'], 'unchecked'),
    `<h2>${escapeHtml(t('welcome.dataTitle'))}</h2>`,
    `<p>${escapeHtml(t('welcome.dataText'))}</p>`,
    `<p>${escapeHtml(t('welcome.outro'))}</p>`
  ].join('')
}
