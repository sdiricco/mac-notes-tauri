// Strings de settings (pt). Chaves camelCase, preenchidas pelo componente homônimo.
export default {
  title: 'Ajustes',
  close: 'Fechar Ajustes',
  allCategories: 'Todas as Categorias',
  categoriesAria: 'Categorias de ajustes',

  sections: {
    general: 'Geral',
    appearance: 'Aparência',
    editor: 'Editor',
    shortcuts: 'Atalhos',
    about: 'Sobre'
  },

  general: {
    language: {
      title: 'Idioma',
      aria: 'Idioma',
      system: 'Sistema',
      note: 'Com "Sistema", o app segue o idioma do seu sistema operacional.'
    },
    list: {
      title: 'Lista de Notas',
      sortLabel: 'Ordenação padrão',
      sortDesc: 'Como a lista de notas é ordenada',
      sortUpdated: 'Data de Modificação',
      sortCreated: 'Data de Criação',
      sortTitle: 'Título'
    }
  },

  appearance: {
    theme: {
      title: 'Tema',
      aria: 'Tema',
      system: 'Sistema',
      light: 'Claro',
      dark: 'Escuro',
      note: 'Com "Sistema", o app segue a aparência clara ou escura do seu sistema operacional.'
    }
  },

  editor: {
    spell: {
      title: 'Ortografia',
      label: 'Verificar ortografia',
      desc: 'Sublinha palavras não reconhecidas enquanto você digita',
      langLabel: 'Idioma',
      langDesc: 'Dicionário usado na verificação ortográfica',
      langIt: 'Italiano',
      langEn: 'Inglês',
      langEs: 'Espanhol',
      langFr: 'Francês',
      langDe: 'Alemão'
    }
  },

  shortcuts: {
    general: {
      title: 'Geral',
      newNote: 'Nova Nota',
      newFolder: 'Nova Pasta',
      duplicateNote: 'Duplicar Nota',
      findInNote: 'Buscar na Nota',
      findInAllNotes: 'Buscar em Todas as Notas',
      toggleSidebar: 'Mostrar/Ocultar Barra Lateral',
      settings: 'Ajustes'
    },
    formatting: {
      title: 'Formatação (no editor)',
      bold: 'Negrito',
      italic: 'Itálico',
      underline: 'Sublinhado',
      strike: 'Tachado',
      inlineCode: 'Código Inline',
      headings: 'Título 1 / 2 / 3',
      normalText: 'Texto Normal',
      orderedList: 'Lista Numerada',
      bulletList: 'Lista com Marcadores',
      checklist: 'Lista de Tarefas',
      quote: 'Citação',
      codeBlock: 'Bloco de Código',
      insertLink: 'Inserir Link',
      undoRedo: 'Desfazer / Refazer'
    }
  },

  data: {
    title: 'Dados',
    folderLabel: 'Pasta das notas',
    folderDesc: 'Onde suas notas são armazenadas no disco. Aponte para uma pasta sincronizada pelo iCloud, Dropbox ou Syncthing para usar as mesmas notas em vários computadores.',
    defaultBadge: 'padrão',
    change: 'Alterar…',
    reset: 'Usar pasta padrão',
    reveal: 'Mostrar no Finder | Mostrar no gerenciador de arquivos',
    confirmMoveTitle: 'Mover suas notas?',
    confirmMove: 'Nenhuma nota para mover. O RustNotes passará a usar {dir}. | Sua nota será movida para {dir}. | Suas {count} notas serão movidas para {dir}.',
    confirmAdoptTitle: 'Usar as notas que já estão lá?',
    confirmAdopt: '{dir} já contém uma nota do RustNotes. O app passará a usá-la; as notas que você vê agora ficam onde estão e não serão mais exibidas. | {dir} já contém {count} notas do RustNotes. O app passará a usá-las; as notas que você vê agora ficam onde estão e não serão mais exibidas.',
    confirm: 'Continuar',
    cancel: 'Cancelar',
    movedToast: 'Notas movidas',
    adoptedToast: 'Pasta das notas alterada',
    toastDetail: 'Agora usando {dir}',
    failedToast: 'Não foi possível alterar a pasta das notas'
  },
  about: {
    exportAll: 'Exportar todas as notas',
    exportAllDesc: 'Cada nota como um arquivo Markdown, uma subpasta por pasta. O Lixo não é incluído.',
    exportAllButton: 'Exportar…',
    title: 'Aplicativo',
    version: 'Versão',
    updates: 'Atualizações',
    updatesDesc: 'Compara com a última versão publicada',
    checking: 'Verificando…',
    checkUpdates: 'Buscar Atualizações',
    available: 'Versão {version} disponível — execute',
    upToDate: 'Você já tem a versão mais recente'
  }
}
