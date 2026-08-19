//! Porting di fileTransfer.js: import/export markdown e gestione immagini.
//!
//! La conversione in data URI per le immagini è portata *identica*
//! all'originale (stesso motivo: WKWebView, come Chromium, non carica
//! `file://` da un'origine `tauri://`), così il frontend non cambia una riga
//! su come consuma il risultato.

use base64::Engine;
use serde::Serialize;
use serde_json::{json, Value};
use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

const MAX_IMAGE_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Serialize)]
pub struct ExportResult {
    #[serde(rename = "filePath")]
    file_path: String,
}

fn image_mime(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    }
}

fn read_image_as_data_uri(path: &Path) -> Result<String, &'static str> {
    let meta = std::fs::metadata(path).map_err(|_| "read-failed")?;
    if meta.len() > MAX_IMAGE_BYTES {
        return Err("too-large");
    }
    let bytes = std::fs::read(path).map_err(|_| "read-failed")?;
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default();
    let mime = image_mime(ext);
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}

/// Dialogo nativo di salvataggio + scrittura del file. `None` se l'utente
/// annulla, esattamente come l'handler Electron restituiva `null`.
#[tauri::command]
pub async fn export_md(
    app: AppHandle,
    markdown: String,
    suggested_name: Option<String>,
) -> Result<Option<ExportResult>, String> {
    let name = suggested_name.filter(|s| !s.is_empty()).unwrap_or_else(|| "nota".into());
    let picked = app
        .dialog()
        .file()
        .set_title("Esporta come Markdown")
        .add_filter("Markdown", &["md"])
        .set_file_name(&format!("{name}.md"))
        .blocking_save_file();

    let Some(file_path) = picked else {
        eprintln!("[mac-notes-tauri] export_md annullato dall'utente");
        return Ok(None);
    };
    let path = file_path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, markdown).map_err(|e| e.to_string())?;
    eprintln!("[mac-notes-tauri] export_md -> {}", path.display());

    Ok(Some(ExportResult {
        file_path: path.display().to_string(),
    }))
}

#[tauri::command]
pub async fn import_md(app: AppHandle) -> Result<Option<Value>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title("Importa Markdown")
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .blocking_pick_file();

    let Some(file_path) = picked else {
        eprintln!("[mac-notes-tauri] import_md annullato dall'utente");
        return Ok(None);
    };
    let path = file_path.into_path().map_err(|e| e.to_string())?;
    let markdown = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    eprintln!("[mac-notes-tauri] import_md <- {} ({} byte)", path.display(), markdown.len());

    Ok(Some(json!({
        "markdown": markdown,
        "filePath": path.display().to_string(),
    })))
}

#[tauri::command]
pub async fn pick_image(app: AppHandle) -> Result<Option<Value>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title("Scegli un'immagine")
        .add_filter("Immagini", &["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"])
        .blocking_pick_file();

    let Some(file_path) = picked else {
        eprintln!("[mac-notes-tauri] pick_image annullato dall'utente");
        return Ok(None);
    };
    let path = file_path.into_path().map_err(|e| e.to_string())?;

    Ok(Some(match read_image_as_data_uri(&path) {
        Ok(data_uri) => {
            eprintln!("[mac-notes-tauri] pick_image -> {} ({} byte base64)", path.display(), data_uri.len());
            json!({ "dataUri": data_uri })
        }
        Err(code) => {
            eprintln!("[mac-notes-tauri] pick_image ERRORE {code} su {}", path.display());
            json!({ "error": code })
        }
    }))
}

/// Per un percorso digitato a mano (non scelto dal dialogo sopra).
#[tauri::command]
pub fn read_local_image(file_path: String) -> Value {
    match read_image_as_data_uri(Path::new(&file_path)) {
        Ok(data_uri) => json!({ "dataUri": data_uri }),
        Err(code) => json!({ "error": code }),
    }
}
