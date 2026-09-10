//! Il ponte fra Rust e il frontend Vue (invariato). Ogni comando ha lo stesso
//! nome del canale IPC Electron originale, per rendere il porting di
//! `utils/api.js` una traduzione riga per riga.

mod file_transfer;
mod menu;
mod store;
mod titlebar;
mod update_check;
mod zoom;

use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, Theme};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
fn store_load(app: AppHandle) -> Result<Value, String> {
    let data = store::load_data(&app)?;
    let n = data
        .get("notes")
        .and_then(Value::as_array)
        .map(|a| a.len())
        .unwrap_or(0);
    eprintln!("[rustnotes] store_load -> {n} note");
    Ok(data)
}

#[tauri::command]
fn store_save_note(app: AppHandle, note: Value) -> Result<bool, String> {
    let id = note
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("?")
        .to_string();
    store::save_note(&app, &note)?;
    eprintln!("[rustnotes] store_save_note -> {id}");
    Ok(true)
}

#[tauri::command]
fn store_delete_note(app: AppHandle, id: String) -> Result<bool, String> {
    store::delete_note(&app, &id)?;
    Ok(true)
}

#[tauri::command]
fn store_save_folders(app: AppHandle, folders: Value) -> Result<bool, String> {
    store::save_folders(&app, &folders)?;
    Ok(true)
}

#[tauri::command]
fn store_reveal_in_finder(app: AppHandle) -> Result<(), String> {
    let dir = store::data_dir(&app)?;
    app.opener()
        .open_path(dir.display().to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn store_data_dir_info(app: AppHandle) -> Result<store::DataDirInfo, String> {
    store::data_dir_info(&app)
}

#[tauri::command]
fn store_inspect_dir(path: String) -> store::DirInspection {
    store::inspect_dir(&path)
}

/// `path` None = torna alla cartella predefinita. Il frontend ricarica lo
/// store subito dopo, perche' l'archivio in uso e' cambiato.
#[tauri::command]
fn store_set_data_dir(
    app: AppHandle,
    path: Option<String>,
) -> Result<store::SetDataDirResult, String> {
    let res = store::set_data_dir(&app, path)?;
    eprintln!(
        "[rustnotes] store_set_data_dir -> {} ({})",
        res.dir, res.mode
    );
    Ok(res)
}

#[tauri::command]
async fn update_check_run(app: AppHandle) -> update_check::UpdateStatus {
    let version = app.package_info().version.to_string();
    let status = update_check::check(version).await;
    let _ = app.emit("update-check:status", status.clone());
    status
}

#[tauri::command]
fn update_check_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

// Sincronizza l'aspetto nativo della finestra (titolo, bottoni di sistema)
// con il tema scelto nell'app: con titleBarStyle "Visible" il colore del
// testo del titolo lo decide macOS in base al Theme della NSWindow, non al
// contenuto della webview — senza questa chiamata restava sul chiaro di
// default anche a contenuto scuro, rendendo il titolo nero su sfondo scuro.
#[tauri::command]
fn set_window_theme(app: AppHandle, dark: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window
            .set_theme(Some(if dark { Theme::Dark } else { Theme::Light }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Geometria della barra del titolo per il CSS (vedi titlebar.rs). Il comando
/// gira sul main thread (Tauri vi esegue i comandi sincroni su macOS), come
/// richiesto da AppKit. Fuori da macOS: barra di 38px e nessun semaforo.
#[tauri::command]
fn titlebar_geometry(app: AppHandle) -> titlebar::Geometry {
    app.get_webview_window("main")
        .and_then(|w| titlebar::geometry(&w))
        .unwrap_or(titlebar::Geometry {
            height: 38.0,
            buttons_end: 0.0,
        })
}

// Ricostruisce il menu nativo nella lingua scelta. Chiamato dal frontend
// all'avvio (con la preferenza salvata) e a ogni cambio lingua.
#[tauri::command]
fn set_menu_language(app: AppHandle, lang: String) -> Result<(), String> {
    let m = menu::build_menu(&app, &lang).map_err(|e| e.to_string())?;
    app.set_menu(m).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            match store::migrate_legacy(&handle) {
                Ok(Some(n)) => eprintln!(
                    "[rustnotes] migrate_legacy -> {n} note copiate dalla cartella precedente"
                ),
                Ok(None) => {}
                Err(e) => eprintln!("[rustnotes] migrate_legacy ERRORE: {e}"),
            }
            let m = menu::build_menu(&handle, menu::system_lang())?;
            app.set_menu(m)?;

            if let Some(window) = app.get_webview_window("main") {
                titlebar::install(&window);
            }

            // Zoom salvato: riapplicato subito, prima che la pagina si veda.
            let saved = store::zoom_get(&handle);
            if (saved - 1.0).abs() > f64::EPSILON {
                let _ = zoom::apply(&handle, saved);
            }

            // Il controllo automatico periodico e' limitato alla build
            // pacchettizzata, come nell'originale (`app.isPackaged`): in dev
            // disturberebbe ogni avvio.
            #[cfg(not(debug_assertions))]
            {
                let handle2 = handle.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(4)).await;
                    loop {
                        let version = handle2.package_info().version.to_string();
                        let status = update_check::check(version).await;
                        let _ = handle2.emit("update-check:status", status);
                        tokio::time::sleep(std::time::Duration::from_secs(4 * 60 * 60)).await;
                    }
                });
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event.id().as_ref());
        })
        .invoke_handler(tauri::generate_handler![
            store_load,
            store_save_note,
            store_delete_note,
            store_save_folders,
            store_reveal_in_finder,
            store_data_dir_info,
            store_inspect_dir,
            store_set_data_dir,
            file_transfer::pick_folder,
            update_check_run,
            update_check_app_version,
            set_window_theme,
            set_menu_language,
            titlebar_geometry,
            zoom::zoom_get,
            zoom::zoom_in,
            zoom::zoom_out,
            zoom::zoom_reset,
            file_transfer::export_md,
            file_transfer::export_all_md,
            file_transfer::import_md,
            file_transfer::pick_image,
            file_transfer::read_local_image,
        ])
        .run(tauri::generate_context!())
        .expect("errore durante l'avvio dell'applicazione Tauri");
}
