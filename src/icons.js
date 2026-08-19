// Registra l'intera collezione Lucide in modo che <Icon icon="lucide:…" />
// funzioni offline (nessuna chiamata all'API Iconify).
import { addCollection } from '@iconify/vue'
import lucide from '@iconify-json/lucide/icons.json'

addCollection(lucide)
