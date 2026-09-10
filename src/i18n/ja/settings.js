// Stringhe settings (ja). Chiavi camelCase, riempite dal componente omonimo.
export default {
  title: '設定',
  close: '設定を閉じる',
  allCategories: 'すべてのカテゴリ',
  categoriesAria: '設定のカテゴリ',

  sections: {
    general: '一般',
    appearance: '外観',
    editor: 'エディタ',
    shortcuts: 'ショートカット',
    about: '情報'
  },

  general: {
    language: {
      title: '言語',
      aria: '言語',
      system: 'システム',
      note: '「システム」を選ぶと、オペレーティングシステムの言語に従います。'
    },
    list: {
      title: 'メモリスト',
      sortLabel: 'デフォルトの並び順',
      sortDesc: 'メモリストの並べ替え方法',
      sortUpdated: '変更日',
      sortCreated: '作成日',
      sortTitle: 'タイトル'
    }
  },

  appearance: {
    theme: {
      title: 'テーマ',
      aria: 'テーマ',
      system: 'システム',
      light: 'ライト',
      dark: 'ダーク',
      note: '「システム」を選ぶと、オペレーティングシステムのライト／ダーク外観に従います。'
    }
  },

  editor: {
    spell: {
      title: 'スペルチェック',
      label: 'スペルチェック',
      desc: '入力中に認識できない単語に下線を表示します',
      langLabel: '言語',
      langDesc: 'スペルチェックに使用する辞書',
      langIt: 'イタリア語',
      langEn: '英語',
      langEs: 'スペイン語',
      langFr: 'フランス語',
      langDe: 'ドイツ語'
    }
  },

  shortcuts: {
    general: {
      title: '一般',
      newNote: '新規メモ',
      newFolder: '新規フォルダ',
      duplicateNote: 'メモを複製',
      findInNote: 'メモ内を検索',
      findInAllNotes: 'すべてのメモを検索',
      toggleSidebar: 'サイドバーを表示/隠す',
      settings: '設定'
    },
    formatting: {
      title: '書式（エディタ内）',
      bold: 'ボールド',
      italic: 'イタリック',
      underline: '下線',
      strike: '取り消し線',
      inlineCode: 'インラインコード',
      headings: '見出し1 / 2 / 3',
      normalText: '本文',
      orderedList: '番号付きリスト',
      bulletList: '箇条書きリスト',
      checklist: 'チェックリスト',
      quote: '引用ブロック',
      codeBlock: 'コードブロック',
      insertLink: 'リンクを挿入',
      undoRedo: '取り消す / やり直す'
    }
  },

  data: {
    title: 'データ',
    folderLabel: 'メモのフォルダ',
    folderDesc: 'メモをディスク上に保存する場所です。iCloud、Dropbox、Syncthingなどで同期されているフォルダを指定すると、複数のコンピュータで同じメモを使えます。',
    defaultBadge: 'デフォルト',
    change: '変更…',
    reset: 'デフォルトのフォルダを使用',
    reveal: 'Finderに表示 | ファイルマネージャに表示',
    confirmMoveTitle: 'メモを移動しますか？',
    confirmMove: '移動するメモはありません。RustNotesは{dir}を使用するようになります。 | メモは{dir}に移動されます。 | {count}個のメモが{dir}に移動されます。',
    confirmAdoptTitle: 'すでにあるメモを使用しますか？',
    confirmAdopt: '{dir}にはすでにRustNotesのメモが1個あります。アプリはそのメモに切り替わります。現在表示されているメモは元の場所に残りますが、表示されなくなります。 | {dir}にはすでにRustNotesのメモが{count}個あります。アプリはそれらのメモに切り替わります。現在表示されているメモは元の場所に残りますが、表示されなくなります。',
    confirm: '続ける',
    cancel: 'キャンセル',
    movedToast: 'メモを移動しました',
    adoptedToast: 'メモのフォルダを変更しました',
    toastDetail: '現在の場所: {dir}',
    failedToast: 'メモのフォルダを変更できませんでした'
  },
  about: {
    exportAll: 'すべてのメモを書き出す',
    exportAllDesc: 'すべてのメモをMarkdownファイルとして、フォルダごとにサブフォルダに書き出します。ゴミ箱は含まれません。',
    exportAllButton: '書き出す…',
    title: 'アプリケーション',
    version: 'バージョン',
    updates: 'アップデート',
    updatesDesc: '最新の公開リリースと比較します',
    checking: '確認中…',
    checkUpdates: 'アップデートを確認',
    available: 'バージョン{version}が利用可能です — 次のコマンドを実行してください:',
    upToDate: '最新バージョンを使用しています'
  }
}
