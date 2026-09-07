//! Porting di menu.js. L'API di tauri::menu è per costruzione diversa da
//! quella di Electron (item con `.on_menu_event` centralizzato invece di una
//! `click` per item, niente `role: 'radio'` nativo), ma le voci sono le
//! stesse.
//!
//! Gap noti rispetto all'originale, dichiarati invece che nascosti:
//! - Reload / Toggle DevTools / Zoom in-out-reset non hanno un
//!   `PredefinedMenuItem` equivalente in Tauri (sono `role` di Electron legati
//!   alla BrowserWindow, non voci di sistema): omessi per ora.
//! - "Porta tutto in primo piano" (role: front) non ha equivalente diretto:
//!   omesso.

use tauri::menu::{Menu, MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Wry};

pub fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let app_menu = SubmenuBuilder::new(app, "mac-notes-tauri")
        .item(&PredefinedMenuItem::about(app, None, None)?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "settings",
            "Impostazioni…",
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

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&MenuItem::with_id(app, "new-note", "Nuova Nota", true, Some("CmdOrCtrl+N"))?)
        .item(&MenuItem::with_id(
            app,
            "new-folder",
            "Nuova Cartella",
            true,
            Some("CmdOrCtrl+Shift+N"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "duplicate-note",
            "Duplica Nota",
            true,
            Some("CmdOrCtrl+D"),
        )?)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Modifica")
        .item(&PredefinedMenuItem::undo(app, Some("Annulla"))?)
        .item(&PredefinedMenuItem::redo(app, Some("Ripeti"))?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some("Taglia"))?)
        .item(&PredefinedMenuItem::copy(app, Some("Copia"))?)
        .item(&PredefinedMenuItem::paste(app, Some("Incolla"))?)
        .item(&PredefinedMenuItem::select_all(app, Some("Seleziona Tutto"))?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "find-in-note",
            "Cerca nella nota",
            true,
            Some("CmdOrCtrl+F"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "search-all",
            "Cerca in tutte le note",
            true,
            Some("CmdOrCtrl+Shift+F"),
        )?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "Vista")
        .item(&MenuItem::with_id(
            app,
            "toggle-sidebar",
            "Mostra/Nascondi Sidebar",
            true,
            Some("CmdOrCtrl+/"),
        )?)
        .item(&MenuItem::with_id(app, "shortcuts", "Scorciatoie da tastiera", true, None::<&str>)?)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Finestra")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "Aiuto")
        .item(&MenuItem::with_id(
            app,
            "help-repo",
            "Repository su GitHub",
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
    eprintln!("[mac-notes-tauri] menu event: {event_id}");

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
        "help-repo" => {
            use tauri_plugin_opener::OpenerExt;
            let _ = app.opener().open_url("https://github.com", None::<&str>);
        }
        _ => {}
    }
}
