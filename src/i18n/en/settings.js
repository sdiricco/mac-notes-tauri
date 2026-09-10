// Stringhe settings (en). Chiavi camelCase, riempite dal componente omonimo.
export default {
  title: 'Settings',
  close: 'Close Settings',
  allCategories: 'All Categories',
  categoriesAria: 'Settings categories',

  sections: {
    general: 'General',
    appearance: 'Appearance',
    editor: 'Editor',
    shortcuts: 'Shortcuts',
    about: 'About'
  },

  general: {
    language: {
      title: 'Language',
      aria: 'Language',
      system: 'System',
      note: 'With "System" the app follows your operating system language.'
    },
    list: {
      title: 'Notes List',
      sortLabel: 'Default sort order',
      sortDesc: 'How the notes list is ordered',
      sortUpdated: 'Date Modified',
      sortCreated: 'Date Created',
      sortTitle: 'Title'
    }
  },

  appearance: {
    theme: {
      title: 'Theme',
      aria: 'Theme',
      system: 'System',
      light: 'Light',
      dark: 'Dark',
      note: 'With "System" the app follows your operating system light or dark appearance.'
    }
  },

  editor: {
    spell: {
      title: 'Spelling',
      label: 'Check spelling',
      desc: 'Underline unrecognized words as you type',
      langLabel: 'Language',
      langDesc: 'Dictionary used for spell checking',
      langIt: 'Italian',
      langEn: 'English',
      langEs: 'Spanish',
      langFr: 'French',
      langDe: 'German'
    }
  },

  shortcuts: {
    general: {
      title: 'General',
      newNote: 'New Note',
      newFolder: 'New Folder',
      duplicateNote: 'Duplicate Note',
      findInNote: 'Find in Note',
      findInAllNotes: 'Find in All Notes',
      toggleSidebar: 'Show/Hide Sidebar',
      settings: 'Settings'
    },
    formatting: {
      title: 'Formatting (in the editor)',
      bold: 'Bold',
      italic: 'Italic',
      underline: 'Underline',
      strike: 'Strikethrough',
      inlineCode: 'Inline Code',
      headings: 'Heading 1 / 2 / 3',
      normalText: 'Body Text',
      orderedList: 'Numbered List',
      bulletList: 'Bulleted List',
      checklist: 'Checklist',
      quote: 'Block Quote',
      codeBlock: 'Code Block',
      insertLink: 'Insert Link',
      undoRedo: 'Undo / Redo'
    }
  },

  data: {
    title: 'Data',
    folderLabel: 'Notes folder',
    folderDesc: 'Where your notes are stored on disk. Point it at a folder synced by iCloud, Dropbox or Syncthing to use the same notes on several computers.',
    defaultBadge: 'default',
    change: 'Change…',
    reset: 'Use default folder',
    reveal: 'Show in Finder | Show in file manager',
    confirmMoveTitle: 'Move your notes?',
    confirmMove: 'No notes to move. RustNotes will start using {dir}. | Your note will be moved to {dir}. | Your {count} notes will be moved to {dir}.',
    confirmAdoptTitle: 'Use the notes already there?',
    confirmAdopt: '{dir} already contains one RustNotes note. The app will switch to it; the notes you see now stay where they are and will no longer be shown. | {dir} already contains {count} RustNotes notes. The app will switch to those; the notes you see now stay where they are and will no longer be shown.',
    confirm: 'Continue',
    cancel: 'Cancel',
    movedToast: 'Notes moved',
    adoptedToast: 'Notes folder changed',
    toastDetail: 'Now using {dir}',
    failedToast: 'Could not change the notes folder'
  },
  about: {
    exportAll: 'Export all notes',
    exportAllDesc: 'Every note as a Markdown file, one subfolder per folder. The trash is not included.',
    exportAllButton: 'Export…',
    title: 'Application',
    version: 'Version',
    updates: 'Updates',
    updatesDesc: 'Compare with the latest published release',
    checking: 'Checking…',
    checkUpdates: 'Check for Updates',
    available: 'Version {version} available — run',
    upToDate: 'You have the latest version'
  }
}
