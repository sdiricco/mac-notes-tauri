//! Il ponte fra Rust e il frontend Vue (invariato). Ogni comando ha lo stesso
//! nome del canale IPC Electron originale, per rendere il porting di
//! `utils/api.js` una traduzione riga per riga.

mod file_transfer;
mod menu;
mod store;
mod update_check;

use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
fn store_load(app: AppHandle) -> Result<Value, String> {
    let data = store::load_data(&app)?;
    let n = data.get("notes").and_then(Value::as_array).map(|a| a.len()).unwrap_or(0);
    eprintln!("[mac-notes-tauri] store_load -> {n} note");
    Ok(data)
}

#[tauri::command]
fn store_save_note(app: AppHandle, note: Value) -> Result<bool, String> {
    let id = note.get("id").and_then(Value::as_str).unwrap_or("?").to_string();
    store::save_note(&app, &note)?;
    eprintln!("[mac-notes-tauri] store_save_note -> {id}");
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
fn menu_sync_toolbar_mode(app: AppHandle, mode: String) -> Result<bool, String> {
    menu::set_toolbar_mode(&app, mode == "extended").map_err(|e| e.to_string())?;
    Ok(true)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let m = menu::build_menu(&handle)?;
            app.set_menu(m)?;

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
            menu_sync_toolbar_mode,
            update_check_run,
            update_check_app_version,
            file_transfer::export_md,
            file_transfer::import_md,
            file_transfer::pick_image,
            file_transfer::read_local_image,
        ])
        .run(tauri::generate_context!())
        .expect("errore durante l'avvio dell'applicazione Tauri");
}
