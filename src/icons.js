// Registra l'intera collezione Lucide in modo che <Icon icon="lucide:…" />
// funzioni offline (nessuna chiamata all'API Iconify): senza questo, in
// un'app desktop pacchettizzata le icone non comparirebbero.
// Usando un'icona di un set diverso va installato @iconify-json/<set> e
// registrato qui, altrimenti resta un buco silenzioso — e per un singolo
// glifo conviene valutarne il peso (Bootstrap Icons, per esempio, sono
// oltre 1 MB contro i 566 KB di Lucide).
import { addCollection } from '@iconify/vue'
import lucide from '@iconify-json/lucide/icons.json'

addCollection(lucide)
