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

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{CheckMenuItem, Menu, MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Wry};

/// Vive qui invece che nel frontend per lo stesso motivo dell'originale: la
/// spunta sul radio "Vista > Toolbar" deve riflettere la preferenza reale
/// anche se il menu viene ricostruito prima che il frontend l'abbia comunicata.
static TOOLBAR_EXTENDED: AtomicBool = AtomicBool::new(false);

#[derive(Serialize, Clone)]
struct ToolbarModePayload(&'static str);

pub fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let extended = TOOLBAR_EXTENDED.load(Ordering::Relaxed);

    let compact = CheckMenuItem::with_id(
        app,
        "toolbar-compact",
        "Compatta",
        true,
        !extended,
        None::<&str>,
    )?;
    let extended_item = CheckMenuItem::with_id(
        app,
        "toolbar-extended",
        "Estesa",
        true,
        extended,
        None::<&str>,
    )?;

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
        .item(&MenuItem::with_id(app, "focus-search", "Cerca", true, Some("CmdOrCtrl+F"))?)
        .build()?;

    let toolbar_submenu = SubmenuBuilder::new(app, "Toolbar")
        .item(&compact)
        .item(&extended_item)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "Vista")
        .item(&MenuItem::with_id(
            app,
            "toggle-sidebar",
            "Mostra/Nascondi Sidebar",
            true,
            Some("CmdOrCtrl+/"),
        )?)
        .item(&toolbar_submenu)
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

/// Ricostruisce il menu con la spunta corretta. Il frontend chiama questo
/// tramite `menu:sync-toolbar-mode` all'avvio, altrimenti la spunta
/// mostrerebbe sempre "Compatta" anche con l'altra modalità attiva salvata
/// in localStorage.
pub fn set_toolbar_mode(app: &AppHandle, extended: bool) -> tauri::Result<()> {
    TOOLBAR_EXTENDED.store(extended, Ordering::Relaxed);
    let menu = build_menu(app)?;
    app.set_menu(menu)?;
    Ok(())
}

/// Dispatcher centrale: a differenza di Electron (una `click` per voce), qui
/// tutti gli eventi menu arrivano a un solo handler distinto per `id`.
pub fn handle_menu_event(app: &AppHandle, event_id: &str) {
    eprintln!("[mac-notes-tauri] menu event: {event_id}");

    let send = |channel: &str, payload: Option<ToolbarModePayload>| {
        let _ = match payload {
            Some(p) => app.emit(channel, p),
            None => app.emit(channel, ()),
        };
    };

    match event_id {
        "settings" => send("menu:settings", None),
        "new-note" => send("menu:new-note", None),
        "new-folder" => send("menu:new-folder", None),
        "duplicate-note" => send("menu:duplicate-note", None),
        "focus-search" => send("menu:focus-search", None),
        "toggle-sidebar" => send("menu:toggle-sidebar", None),
        "shortcuts" => send("menu:shortcuts", None),
        "toolbar-compact" => {
            let _ = set_toolbar_mode(app, false);
            send("menu:toolbar-mode", Some(ToolbarModePayload("compact")));
        }
        "toolbar-extended" => {
            let _ = set_toolbar_mode(app, true);
            send("menu:toolbar-mode", Some(ToolbarModePayload("extended")));
        }
        "help-repo" => {
            use tauri_plugin_opener::OpenerExt;
            let _ = app.opener().open_url("https://github.com", None::<&str>);
        }
        _ => {}
    }
}
