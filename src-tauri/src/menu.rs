//! Porting di menu.js. L'API di tauri::menu è per costruzione diversa da
//! quella di Electron (item con `.on_menu_event` centralizzato invece di una
//! `click` per item, niente `role: 'radio'` nativo), ma le voci sono le
//! stesse.
//!
//! Gap noti rispetto all'originale, dichiarati invece che nascosti:
//! - Reload / Toggle DevTools non hanno un `PredefinedMenuItem` equivalente
//!   in Tauri (sono `role` di Electron legati alla BrowserWindow): omessi.
//!   Lo zoom, che era nello stesso gruppo, e' implementato a mano (zoom.rs).
//! - "Porta tutto in primo piano" (role: front) non ha equivalente diretto:
//!   omesso.

use tauri::menu::{Menu, MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Wry};

/// Etichette del menu nativo. Il menu vive in Rust, fuori dalla webview,
/// quindi non puo' usare vue-i18n: ha la sua tabella, una riga per lingua,
/// e il frontend lo ricostruisce con `set_menu_language` quando l'utente
/// cambia lingua nelle impostazioni. Tenere le chiavi allineate con
/// src/i18n/*/app.js non e' automatico: sono poche voci e cambiano di rado.
struct Labels {
    settings: &'static str,
    file: &'static str,
    new_note: &'static str,
    new_folder: &'static str,
    duplicate_note: &'static str,
    edit: &'static str,
    undo: &'static str,
    redo: &'static str,
    cut: &'static str,
    copy: &'static str,
    paste: &'static str,
    select_all: &'static str,
    find_in_note: &'static str,
    search_all: &'static str,
    view: &'static str,
    toggle_sidebar: &'static str,
    shortcuts: &'static str,
    zoom_in: &'static str,
    zoom_out: &'static str,
    zoom_reset: &'static str,
    window: &'static str,
    help: &'static str,
    help_repo: &'static str,
}

const EN: Labels = Labels {
    settings: "Settings…",
    file: "File",
    new_note: "New Note",
    new_folder: "New Folder",
    duplicate_note: "Duplicate Note",
    edit: "Edit",
    undo: "Undo",
    redo: "Redo",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    select_all: "Select All",
    find_in_note: "Find in Note",
    search_all: "Search All Notes",
    view: "View",
    toggle_sidebar: "Show/Hide Sidebar",
    shortcuts: "Keyboard Shortcuts",
    zoom_in: "Zoom In",
    zoom_out: "Zoom Out",
    zoom_reset: "Actual Size",
    window: "Window",
    help: "Help",
    help_repo: "GitHub Repository",
};

const IT: Labels = Labels {
    settings: "Impostazioni…",
    file: "File",
    new_note: "Nuova Nota",
    new_folder: "Nuova Cartella",
    duplicate_note: "Duplica Nota",
    edit: "Modifica",
    undo: "Annulla",
    redo: "Ripeti",
    cut: "Taglia",
    copy: "Copia",
    paste: "Incolla",
    select_all: "Seleziona Tutto",
    find_in_note: "Cerca nella nota",
    search_all: "Cerca in tutte le note",
    view: "Vista",
    toggle_sidebar: "Mostra/Nascondi Sidebar",
    shortcuts: "Scorciatoie da tastiera",
    zoom_in: "Ingrandisci",
    zoom_out: "Riduci",
    zoom_reset: "Dimensione effettiva",
    window: "Finestra",
    help: "Aiuto",
    help_repo: "Repository su GitHub",
};

const ES: Labels = Labels {
    settings: "Ajustes…",
    file: "Archivo",
    new_note: "Nueva nota",
    new_folder: "Nueva carpeta",
    duplicate_note: "Duplicar nota",
    edit: "Edición",
    undo: "Deshacer",
    redo: "Rehacer",
    cut: "Cortar",
    copy: "Copiar",
    paste: "Pegar",
    select_all: "Seleccionar todo",
    find_in_note: "Buscar en la nota",
    search_all: "Buscar en todas las notas",
    view: "Visualización",
    toggle_sidebar: "Mostrar/ocultar barra lateral",
    shortcuts: "Atajos de teclado",
    zoom_in: "Acercar",
    zoom_out: "Alejar",
    zoom_reset: "Tamaño real",
    window: "Ventana",
    help: "Ayuda",
    help_repo: "Repositorio en GitHub",
};

const FR: Labels = Labels {
    settings: "Réglages…",
    file: "Fichier",
    new_note: "Nouvelle note",
    new_folder: "Nouveau dossier",
    duplicate_note: "Dupliquer la note",
    edit: "Édition",
    undo: "Annuler",
    redo: "Rétablir",
    cut: "Couper",
    copy: "Copier",
    paste: "Coller",
    select_all: "Tout sélectionner",
    find_in_note: "Rechercher dans la note",
    search_all: "Rechercher dans toutes les notes",
    view: "Présentation",
    toggle_sidebar: "Afficher/masquer la barre latérale",
    shortcuts: "Raccourcis clavier",
    zoom_in: "Zoom avant",
    zoom_out: "Zoom arrière",
    zoom_reset: "Taille réelle",
    window: "Fenêtre",
    help: "Aide",
    help_repo: "Dépôt GitHub",
};

const DE: Labels = Labels {
    settings: "Einstellungen…",
    file: "Ablage",
    new_note: "Neue Notiz",
    new_folder: "Neuer Ordner",
    duplicate_note: "Notiz duplizieren",
    edit: "Bearbeiten",
    undo: "Widerrufen",
    redo: "Wiederholen",
    cut: "Ausschneiden",
    copy: "Kopieren",
    paste: "Einsetzen",
    select_all: "Alles auswählen",
    find_in_note: "In Notiz suchen",
    search_all: "In allen Notizen suchen",
    view: "Darstellung",
    toggle_sidebar: "Seitenleiste ein-/ausblenden",
    shortcuts: "Tastaturkurzbefehle",
    zoom_in: "Vergrößern",
    zoom_out: "Verkleinern",
    zoom_reset: "Originalgröße",
    window: "Fenster",
    help: "Hilfe",
    help_repo: "GitHub-Repository",
};

const PT: Labels = Labels {
    settings: "Ajustes…",
    file: "Arquivo",
    new_note: "Nova Nota",
    new_folder: "Nova Pasta",
    duplicate_note: "Duplicar Nota",
    edit: "Editar",
    undo: "Desfazer",
    redo: "Refazer",
    cut: "Recortar",
    copy: "Copiar",
    paste: "Colar",
    select_all: "Selecionar Tudo",
    find_in_note: "Buscar na Nota",
    search_all: "Buscar em Todas as Notas",
    view: "Visualizar",
    toggle_sidebar: "Mostrar/Ocultar Barra Lateral",
    shortcuts: "Atalhos de Teclado",
    zoom_in: "Ampliar",
    zoom_out: "Reduzir",
    zoom_reset: "Tamanho Real",
    window: "Janela",
    help: "Ajuda",
    help_repo: "Repositório no GitHub",
};

const ZH: Labels = Labels {
    settings: "设置…",
    file: "文件",
    new_note: "新建备忘录",
    new_folder: "新建文件夹",
    duplicate_note: "复制备忘录",
    edit: "编辑",
    undo: "撤销",
    redo: "重做",
    cut: "剪切",
    copy: "拷贝",
    paste: "粘贴",
    select_all: "全选",
    find_in_note: "在备忘录中查找",
    search_all: "搜索所有备忘录",
    view: "显示",
    toggle_sidebar: "显示/隐藏边栏",
    shortcuts: "键盘快捷键",
    zoom_in: "放大",
    zoom_out: "缩小",
    zoom_reset: "实际大小",
    window: "窗口",
    help: "帮助",
    help_repo: "GitHub 仓库",
};

const JA: Labels = Labels {
    settings: "設定…",
    file: "ファイル",
    new_note: "新規メモ",
    new_folder: "新規フォルダ",
    duplicate_note: "メモを複製",
    edit: "編集",
    undo: "取り消す",
    redo: "やり直す",
    cut: "カット",
    copy: "コピー",
    paste: "ペースト",
    select_all: "すべてを選択",
    find_in_note: "メモ内を検索",
    search_all: "すべてのメモを検索",
    view: "表示",
    toggle_sidebar: "サイドバーを表示/非表示",
    shortcuts: "キーボードショートカット",
    zoom_in: "拡大",
    zoom_out: "縮小",
    zoom_reset: "実際のサイズ",
    window: "ウインドウ",
    help: "ヘルプ",
    help_repo: "GitHub リポジトリ",
};

fn labels(lang: &str) -> &'static Labels {
    match lang {
        "it" => &IT,
        "es" => &ES,
        "fr" => &FR,
        "de" => &DE,
        "pt" => &PT,
        "zh" => &ZH,
        "ja" => &JA,
        _ => &EN,
    }
}

/// Lingue supportate, allineate a SUPPORTED_LOCALES in src/i18n/index.js.
const SUPPORTED: &[&str] = &["en", "it", "es", "fr", "de", "pt", "zh", "ja"];

/// Lingua iniziale del menu, prima che il frontend comunichi la preferenza
/// salvata: quella di sistema se supportata, altrimenti inglese. Lo stesso
/// criterio di resolveLocale() in src/i18n/index.js.
pub fn system_lang() -> &'static str {
    let sys = sys_locale::get_locale().unwrap_or_default().to_lowercase();
    SUPPORTED
        .iter()
        .find(|l| sys.starts_with(*l))
        .copied()
        .unwrap_or("en")
}

#[cfg(target_os = "macos")]
const ZOOM_IN_ACCEL: &str = "CmdOrCtrl+NumpadAdd";
#[cfg(not(target_os = "macos"))]
const ZOOM_IN_ACCEL: &str = "CmdOrCtrl+=";

pub fn build_menu(app: &AppHandle, lang: &str) -> tauri::Result<Menu<Wry>> {
    let l = labels(lang);
    let app_menu = SubmenuBuilder::new(app, "RustNotes")
        .item(&PredefinedMenuItem::about(app, None, None)?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "settings",
            l.settings,
            true,
            Some("CmdOrCtrl+,"),
        )?)
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    let file_menu = SubmenuBuilder::new(app, l.file)
        .item(&MenuItem::with_id(
            app,
            "new-note",
            l.new_note,
            true,
            Some("CmdOrCtrl+N"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "new-folder",
            l.new_folder,
            true,
            Some("CmdOrCtrl+Shift+N"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "duplicate-note",
            l.duplicate_note,
            true,
            Some("CmdOrCtrl+D"),
        )?)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, l.edit)
        .item(&PredefinedMenuItem::undo(app, Some(l.undo))?)
        .item(&PredefinedMenuItem::redo(app, Some(l.redo))?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some(l.cut))?)
        .item(&PredefinedMenuItem::copy(app, Some(l.copy))?)
        .item(&PredefinedMenuItem::paste(app, Some(l.paste))?)
        .item(&PredefinedMenuItem::select_all(app, Some(l.select_all))?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "find-in-note",
            l.find_in_note,
            true,
            Some("CmdOrCtrl+F"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "search-all",
            l.search_all,
            true,
            Some("CmdOrCtrl+Shift+F"),
        )?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, l.view)
        .item(&MenuItem::with_id(
            app,
            "toggle-sidebar",
            l.toggle_sidebar,
            true,
            Some("CmdOrCtrl+/"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "shortcuts",
            l.shortcuts,
            true,
            None::<&str>,
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "zoom-in",
            l.zoom_in,
            true,
            Some(ZOOM_IN_ACCEL),
        )?)
        .item(&MenuItem::with_id(
            app,
            "zoom-out",
            l.zoom_out,
            true,
            Some("CmdOrCtrl+-"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "zoom-reset",
            l.zoom_reset,
            true,
            Some("CmdOrCtrl+0"),
        )?)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, l.window)
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .build()?;

    let help_menu = SubmenuBuilder::new(app, l.help)
        .item(&MenuItem::with_id(
            app,
            "help-repo",
            l.help_repo,
            true,
            None::<&str>,
        )?)
        .build()?;

    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .item(&help_menu)
        .build()
}

/// Dispatcher centrale: a differenza di Electron (una `click` per voce), qui
/// tutti gli eventi menu arrivano a un solo handler distinto per `id`.
pub fn handle_menu_event(app: &AppHandle, event_id: &str) {
    eprintln!("[rustnotes] menu event: {event_id}");

    // Nessuna voce porta piu' un payload (l'unica era il radio della
    // toolbar, ora rimosso): il canale basta.
    let send = |channel: &str| {
        let _ = app.emit(channel, ());
    };

    match event_id {
        "settings" => send("menu:settings"),
        "new-note" => send("menu:new-note"),
        "new-folder" => send("menu:new-folder"),
        "duplicate-note" => send("menu:duplicate-note"),
        "find-in-note" => send("menu:find-in-note"),
        "search-all" => send("menu:search-all"),
        "toggle-sidebar" => send("menu:toggle-sidebar"),
        "shortcuts" => send("menu:shortcuts"),
        "zoom-in" => {
            crate::zoom::bump(app, 1.0);
        }
        "zoom-out" => {
            crate::zoom::bump(app, -1.0);
        }
        "zoom-reset" => {
            crate::zoom::reset(app);
        }
        "help-repo" => {
            use tauri_plugin_opener::OpenerExt;
            let _ = app
                .opener()
                .open_url("https://github.com/sdiricco/rustnotes", None::<&str>);
        }
        _ => {}
    }
}
