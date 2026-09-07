import { stripHtml } from './markdown'

// Formato e anteprima delle note come li mostra la lista. Stanno qui perche'
// li usano piu' punti (la lista, il menu del breadcrumb e il pannello di
// ricerca nell'header): con una copia per componente i formati finivano per
// divergere — l'header mostrava la data senza l'anno mentre la lista con.

// Oggi -> solo l'ora, altrimenti la data: in una lista di note viste di
// recente l'ora e' l'informazione che distingue, il giorno no.
export function formatNoteDate(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const isToday = date.toDateString() === new Date().toDateString()
  return isToday
    ? date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Testo semplice del contenuto, per la riga di anteprima. Il fallback evita
// una riga vuota che farebbe "saltare" l'altezza delle voci nell'elenco.
export function notePreview(content) {
  const text = stripHtml(content)
  return text.length ? text : 'Nessun testo aggiuntivo'
}
