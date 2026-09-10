// Einstellungs-Strings (de). Schlüssel in camelCase, befüllt von der gleichnamigen Komponente.
export default {
  title: 'Einstellungen',
  close: 'Einstellungen schließen',
  allCategories: 'Alle Kategorien',
  categoriesAria: 'Einstellungskategorien',

  sections: {
    general: 'Allgemein',
    appearance: 'Erscheinungsbild',
    editor: 'Editor',
    shortcuts: 'Kurzbefehle',
    about: 'Info'
  },

  general: {
    language: {
      title: 'Sprache',
      aria: 'Sprache',
      system: 'System',
      note: 'Mit „System“ folgt die App der Sprache Ihres Betriebssystems.'
    },
    list: {
      title: 'Notizenliste',
      sortLabel: 'Standardsortierung',
      sortDesc: 'Wie die Notizenliste sortiert wird',
      sortUpdated: 'Änderungsdatum',
      sortCreated: 'Erstellungsdatum',
      sortTitle: 'Titel'
    }
  },

  appearance: {
    theme: {
      title: 'Erscheinungsbild',
      aria: 'Erscheinungsbild',
      system: 'System',
      light: 'Hell',
      dark: 'Dunkel',
      note: 'Mit „System“ folgt die App dem hellen oder dunklen Erscheinungsbild Ihres Betriebssystems.'
    }
  },

  editor: {
    spell: {
      title: 'Rechtschreibung',
      label: 'Rechtschreibung prüfen',
      desc: 'Unbekannte Wörter beim Tippen unterstreichen',
      langLabel: 'Sprache',
      langDesc: 'Wörterbuch für die Rechtschreibprüfung',
      langIt: 'Italienisch',
      langEn: 'Englisch',
      langEs: 'Spanisch',
      langFr: 'Französisch',
      langDe: 'Deutsch'
    }
  },

  shortcuts: {
    general: {
      title: 'Allgemein',
      newNote: 'Neue Notiz',
      newFolder: 'Neuer Ordner',
      duplicateNote: 'Notiz duplizieren',
      findInNote: 'In Notiz suchen',
      findInAllNotes: 'In allen Notizen suchen',
      toggleSidebar: 'Seitenleiste ein-/ausblenden',
      settings: 'Einstellungen',
      zoomIn: 'Vergrößern',
      zoomOut: 'Verkleinern',
      zoomReset: 'Originalgröße'
    },
    formatting: {
      title: 'Formatierung (im Editor)',
      bold: 'Fett',
      italic: 'Kursiv',
      underline: 'Unterstrichen',
      strike: 'Durchgestrichen',
      inlineCode: 'Inline-Code',
      headings: 'Überschrift 1 / 2 / 3',
      normalText: 'Textkörper',
      orderedList: 'Nummerierte Liste',
      bulletList: 'Aufzählungsliste',
      checklist: 'Checkliste',
      quote: 'Zitat',
      codeBlock: 'Codeblock',
      insertLink: 'Link einfügen',
      undoRedo: 'Widerrufen / Wiederholen'
    }
  },

  data: {
    title: 'Daten',
    folderLabel: 'Notizenordner',
    folderDesc: 'Wo Ihre Notizen auf der Festplatte gespeichert werden. Wählen Sie einen von iCloud, Dropbox oder Syncthing synchronisierten Ordner, um dieselben Notizen auf mehreren Computern zu verwenden.',
    defaultBadge: 'Standard',
    change: 'Ändern…',
    reset: 'Standardordner verwenden',
    reveal: 'Im Finder anzeigen | Im Dateimanager anzeigen',
    confirmMoveTitle: 'Notizen bewegen?',
    confirmMove: 'Keine Notizen zu bewegen. RustNotes verwendet ab jetzt {dir}. | Ihre Notiz wird nach {dir} bewegt. | Ihre {count} Notizen werden nach {dir} bewegt.',
    confirmAdoptTitle: 'Die dort vorhandenen Notizen verwenden?',
    confirmAdopt: '{dir} enthält bereits eine RustNotes-Notiz. Die App wechselt zu dieser; die aktuell angezeigten Notizen bleiben, wo sie sind, und werden nicht mehr angezeigt. | {dir} enthält bereits {count} RustNotes-Notizen. Die App wechselt zu diesen; die aktuell angezeigten Notizen bleiben, wo sie sind, und werden nicht mehr angezeigt.',
    confirm: 'Fortfahren',
    cancel: 'Abbrechen',
    movedToast: 'Notizen bewegt',
    adoptedToast: 'Notizenordner geändert',
    toastDetail: 'Jetzt in Verwendung: {dir}',
    failedToast: 'Der Notizenordner konnte nicht geändert werden'
  },
  about: {
    exportAll: 'Alle Notizen exportieren',
    exportAllDesc: 'Jede Notiz als Markdown-Datei, ein Unterordner pro Ordner. Der Papierkorb wird nicht einbezogen.',
    exportAllButton: 'Exportieren…',
    title: 'Programm',
    version: 'Version',
    updates: 'Updates',
    updatesDesc: 'Mit der neuesten veröffentlichten Version vergleichen',
    checking: 'Wird geprüft…',
    checkUpdates: 'Nach Updates suchen',
    available: 'Version {version} verfügbar — ausführen:',
    upToDate: 'Sie haben die neueste Version'
  }
}
