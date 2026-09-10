// Stringhe settings (it). Chiavi camelCase, riempite dal componente omonimo.
export default {
  title: 'Impostazioni',
  close: 'Chiudi impostazioni',
  allCategories: 'Tutte le categorie',
  categoriesAria: 'Categorie impostazioni',

  sections: {
    general: 'Generale',
    appearance: 'Aspetto',
    editor: 'Editor',
    shortcuts: 'Scorciatoie',
    about: 'Informazioni'
  },

  general: {
    language: {
      title: 'Lingua',
      aria: 'Lingua',
      system: 'Sistema',
      note: 'Con "Sistema" l\'app segue la lingua del sistema operativo.'
    },
    list: {
      title: 'Elenco note',
      sortLabel: 'Ordinamento predefinito',
      sortDesc: "Criterio con cui e' ordinato l'elenco delle note",
      sortUpdated: 'Data modifica',
      sortCreated: 'Data creazione',
      sortTitle: 'Titolo'
    }
  },

  appearance: {
    theme: {
      title: 'Tema',
      aria: 'Tema',
      system: 'Sistema',
      light: 'Chiaro',
      dark: 'Scuro',
      note: 'Con "Sistema" l\'app segue l\'aspetto chiaro o scuro del sistema operativo.'
    }
  },

  editor: {
    spell: {
      title: 'Correzione ortografica',
      label: 'Correzione ortografica',
      desc: 'Sottolinea le parole non riconosciute mentre scrivi',
      langLabel: 'Lingua',
      langDesc: 'Dizionario usato per la correzione',
      langIt: 'Italiano',
      langEn: 'Inglese',
      langEs: 'Spagnolo',
      langFr: 'Francese',
      langDe: 'Tedesco'
    }
  },

  shortcuts: {
    general: {
      title: 'Generale',
      newNote: 'Nuova nota',
      newFolder: 'Nuova cartella',
      duplicateNote: 'Duplica nota',
      findInNote: 'Cerca nella nota',
      findInAllNotes: 'Cerca in tutte le note',
      toggleSidebar: 'Mostra/Nascondi sidebar',
      settings: 'Impostazioni',
      zoomIn: 'Ingrandisci',
      zoomOut: 'Riduci',
      zoomReset: 'Dimensione effettiva'
    },
    formatting: {
      title: 'Formattazione (nell’editor)',
      bold: 'Grassetto',
      italic: 'Corsivo',
      underline: 'Sottolineato',
      strike: 'Barrato',
      inlineCode: 'Codice inline',
      headings: 'Titolo 1 / 2 / 3',
      normalText: 'Testo normale',
      orderedList: 'Elenco numerato',
      bulletList: 'Elenco puntato',
      checklist: 'Elenco di controllo',
      quote: 'Citazione',
      codeBlock: 'Blocco di codice',
      insertLink: 'Inserisci link',
      undoRedo: 'Annulla / Ripeti'
    }
  },

  data: {
    title: 'Dati',
    folderLabel: 'Cartella delle note',
    folderDesc: 'Dove le note sono salvate sul disco. Puntala a una cartella sincronizzata da iCloud, Dropbox o Syncthing per usare le stesse note su piu\' computer.',
    defaultBadge: 'predefinita',
    change: 'Cambia…',
    reset: 'Usa la cartella predefinita',
    reveal: 'Mostra nel Finder | Mostra nel gestore file',
    confirmMoveTitle: 'Spostare le note?',
    confirmMove: 'Nessuna nota da spostare. RustNotes inizierà a usare {dir}. | La tua nota verrà spostata in {dir}. | Le tue {count} note verranno spostate in {dir}.',
    confirmAdoptTitle: 'Usare le note già presenti?',
    confirmAdopt: '{dir} contiene già una nota di RustNotes. L\'app passerà a quella; le note che vedi ora restano dove sono e non verranno più mostrate. | {dir} contiene già {count} note di RustNotes. L\'app passerà a quelle; le note che vedi ora restano dove sono e non verranno più mostrate.',
    confirm: 'Continua',
    cancel: 'Annulla',
    movedToast: 'Note spostate',
    adoptedToast: 'Cartella delle note cambiata',
    toastDetail: 'Ora in uso: {dir}',
    failedToast: 'Impossibile cambiare la cartella delle note'
  },
  about: {
    exportAll: 'Esporta tutte le note',
    exportAllDesc: 'Ogni nota come file Markdown, una sottocartella per cartella. Il cestino e\' escluso.',
    exportAllButton: 'Esporta…',
    title: 'Applicazione',
    version: 'Versione',
    updates: 'Aggiornamenti',
    updatesDesc: "Confronta con l'ultima versione pubblicata",
    checking: 'Verifica…',
    checkUpdates: 'Controlla aggiornamenti',
    available: 'Versione {version} disponibile — esegui',
    upToDate: 'Hai già la versione più recente'
  }
}
