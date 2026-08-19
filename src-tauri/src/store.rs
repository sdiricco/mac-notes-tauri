//! Porting di store.js: una nota per file (invece di un unico blob), stesso
//! ragionamento dell'originale — a queste dimensioni il collo di bottiglia è
//! il numero di operazioni su file, non il formato di serializzazione.
//!
//! Le note e le cartelle sono `serde_json::Value`, non struct tipizzate: lo
//! schema vive nel frontend (stores/notes.js), esattamente come nell'originale
//! Electron, che fa `JSON.parse`/`JSON.stringify` senza validare la forma.
//! Aggiungere un campo nota in Vue non richiede toccare Rust.

use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn notes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(root.join("notes"))
}

fn folders_file(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(root.join("folders.json"))
}

fn ensure_dirs(app: &AppHandle) -> Result<(), String> {
    let dir = notes_dir(app)?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn default_folders() -> Value {
    json!([{ "id": uuid_v4(), "name": "Note", "createdAt": now_ms() }])
}

/// UUID v4 senza dipendenza esterna: qui basta un identificatore unico, non
/// serve conformità stretta alla RFC. Il frontend ne genera già uno vero
/// (pacchetto `uuid`) per le note create dall'utente; questo serve solo per
/// il seed iniziale della cartella di default.
fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("seed-{nanos:x}")
}

fn now_ms() -> u128 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

pub fn load_data(app: &AppHandle) -> Result<Value, String> {
    ensure_dirs(app)?;

    let ffile = folders_file(app)?;
    let folders: Value = if ffile.exists() {
        fs::read_to_string(&ffile)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_else(default_folders)
    } else {
        let f = default_folders();
        let _ = fs::write(&ffile, serde_json::to_string_pretty(&f).unwrap_or_default());
        f
    };

    let ndir = notes_dir(app)?;
    let mut notes = Vec::new();
    if let Ok(entries) = fs::read_dir(&ndir) {
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            // Un file corrotto viene saltato, non fa fallire il caricamento
            // dell'intero archivio: stessa scelta dell'originale JS.
            if let Ok(raw) = fs::read_to_string(&path) {
                if let Ok(note) = serde_json::from_str::<Value>(&raw) {
                    notes.push(note);
                }
            }
        }
    }

    Ok(json!({ "folders": folders, "notes": notes }))
}

pub fn save_note(app: &AppHandle, note: &Value) -> Result<(), String> {
    ensure_dirs(app)?;
    let id = note
        .get("id")
        .and_then(Value::as_str)
        .ok_or("la nota non ha un campo 'id' valido")?;
    let path = note_path(app, id)?;
    let text = serde_json::to_string_pretty(note).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

pub fn delete_note(app: &AppHandle, id: &str) -> Result<(), String> {
    let path = note_path(app, id)?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn save_folders(app: &AppHandle, folders: &Value) -> Result<(), String> {
    ensure_dirs(app)?;
    let path = folders_file(app)?;
    let text = serde_json::to_string_pretty(folders).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

pub fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    notes_dir(app)
}

fn note_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    Ok(notes_dir(app)?.join(format!("{id}.json")))
}
