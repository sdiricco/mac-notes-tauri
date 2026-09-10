// Stringhe settings (es). Chiavi camelCase, riempite dal componente omonimo.
export default {
  title: 'Ajustes',
  close: 'Cerrar ajustes',
  allCategories: 'Todas las categorías',
  categoriesAria: 'Categorías de ajustes',

  sections: {
    general: 'General',
    appearance: 'Apariencia',
    editor: 'Editor',
    shortcuts: 'Atajos',
    about: 'Acerca de'
  },

  general: {
    language: {
      title: 'Idioma',
      aria: 'Idioma',
      system: 'Sistema',
      note: 'Con "Sistema" la app sigue el idioma del sistema operativo.'
    },
    list: {
      title: 'Lista de notas',
      sortLabel: 'Orden predeterminado',
      sortDesc: 'Cómo se ordena la lista de notas',
      sortUpdated: 'Fecha de modificación',
      sortCreated: 'Fecha de creación',
      sortTitle: 'Título'
    }
  },

  appearance: {
    theme: {
      title: 'Tema',
      aria: 'Tema',
      system: 'Sistema',
      light: 'Claro',
      dark: 'Oscuro',
      note: 'Con "Sistema" la app sigue la apariencia clara u oscura del sistema operativo.'
    }
  },

  editor: {
    spell: {
      title: 'Ortografía',
      label: 'Revisar ortografía',
      desc: 'Subraya las palabras no reconocidas mientras escribe',
      langLabel: 'Idioma',
      langDesc: 'Diccionario usado para la revisión ortográfica',
      langIt: 'Italiano',
      langEn: 'Inglés',
      langEs: 'Español',
      langFr: 'Francés',
      langDe: 'Alemán'
    }
  },

  shortcuts: {
    general: {
      title: 'General',
      newNote: 'Nueva nota',
      newFolder: 'Nueva carpeta',
      duplicateNote: 'Duplicar nota',
      findInNote: 'Buscar en la nota',
      findInAllNotes: 'Buscar en todas las notas',
      toggleSidebar: 'Mostrar/Ocultar barra lateral',
      settings: 'Ajustes',
      zoomIn: 'Acercar',
      zoomOut: 'Alejar',
      zoomReset: 'Tamaño real'
    },
    formatting: {
      title: 'Formato (en el editor)',
      bold: 'Negrita',
      italic: 'Cursiva',
      underline: 'Subrayado',
      strike: 'Tachado',
      inlineCode: 'Código en línea',
      headings: 'Encabezado 1 / 2 / 3',
      normalText: 'Texto normal',
      orderedList: 'Lista numerada',
      bulletList: 'Lista con viñetas',
      checklist: 'Lista de verificación',
      quote: 'Cita',
      codeBlock: 'Bloque de código',
      insertLink: 'Insertar enlace',
      undoRedo: 'Deshacer / Rehacer'
    }
  },

  data: {
    title: 'Datos',
    folderLabel: 'Carpeta de notas',
    folderDesc: 'Dónde se guardan sus notas en el disco. Elija una carpeta sincronizada por iCloud, Dropbox o Syncthing para usar las mismas notas en varios equipos.',
    defaultBadge: 'predeterminada',
    change: 'Cambiar…',
    reset: 'Usar la carpeta predeterminada',
    reveal: 'Mostrar en el Finder | Mostrar en el gestor de archivos',
    confirmMoveTitle: '¿Mover sus notas?',
    confirmMove: 'No hay notas que mover. RustNotes empezará a usar {dir}. | Su nota se moverá a {dir}. | Sus {count} notas se moverán a {dir}.',
    confirmAdoptTitle: '¿Usar las notas que ya están ahí?',
    confirmAdopt: '{dir} ya contiene una nota de RustNotes. La app cambiará a ella; las notas que ve ahora se quedan donde están y dejarán de mostrarse. | {dir} ya contiene {count} notas de RustNotes. La app cambiará a ellas; las notas que ve ahora se quedan donde están y dejarán de mostrarse.',
    confirm: 'Continuar',
    cancel: 'Cancelar',
    movedToast: 'Notas movidas',
    adoptedToast: 'Carpeta de notas cambiada',
    toastDetail: 'Ahora se usa {dir}',
    failedToast: 'No se pudo cambiar la carpeta de notas'
  },
  about: {
    exportAll: 'Exportar todas las notas',
    exportAllDesc: 'Cada nota como archivo Markdown, una subcarpeta por carpeta. La papelera no se incluye.',
    exportAllButton: 'Exportar…',
    title: 'Aplicación',
    version: 'Versión',
    updates: 'Actualizaciones',
    updatesDesc: 'Compara con la última versión publicada',
    checking: 'Comprobando…',
    checkUpdates: 'Buscar actualizaciones',
    available: 'Versión {version} disponible — ejecute',
    upToDate: 'Tiene la versión más reciente'
  }
}
