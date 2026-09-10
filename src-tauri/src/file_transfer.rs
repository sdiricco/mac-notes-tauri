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
    title: Option<String>,
) -> Result<Option<ExportResult>, String> {
    let name = suggested_name
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "note".into());
    let picked = app
        .dialog()
        .file()
        .set_title(title.as_deref().unwrap_or("Export as Markdown"))
        .add_filter("Markdown", &["md"])
        .set_file_name(format!("{name}.md"))
        .blocking_save_file();

    let Some(file_path) = picked else {
        eprintln!("[rustnotes] export_md annullato dall'utente");
        return Ok(None);
    };
    let path = file_path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, markdown).map_err(|e| e.to_string())?;
    eprintln!("[rustnotes] export_md -> {}", path.display());

    Ok(Some(ExportResult {
        file_path: path.display().to_string(),
    }))
}

#[tauri::command]
pub async fn import_md(app: AppHandle, title: Option<String>) -> Result<Option<Value>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title(title.as_deref().unwrap_or("Import Markdown"))
        .add_filter("Markdown", &["md", "markdown", "txt"])
        .blocking_pick_file();

    let Some(file_path) = picked else {
        eprintln!("[rustnotes] import_md annullato dall'utente");
        return Ok(None);
    };
    let path = file_path.into_path().map_err(|e| e.to_string())?;
    let markdown = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    eprintln!(
        "[rustnotes] import_md <- {} ({} byte)",
        path.display(),
        markdown.len()
    );

    Ok(Some(json!({
        "markdown": markdown,
        "filePath": path.display().to_string(),
    })))
}

#[tauri::command]
pub async fn pick_image(
    app: AppHandle,
    title: Option<String>,
    filter_label: Option<String>,
) -> Result<Option<Value>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title(title.as_deref().unwrap_or("Choose an image"))
        .add_filter(
            filter_label.as_deref().unwrap_or("Images"),
            &["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"],
        )
        .blocking_pick_file();

    let Some(file_path) = picked else {
        eprintln!("[rustnotes] pick_image annullato dall'utente");
        return Ok(None);
    };
    let path = file_path.into_path().map_err(|e| e.to_string())?;

    Ok(Some(match read_image_as_data_uri(&path) {
        Ok(data_uri) => {
            eprintln!(
                "[rustnotes] pick_image -> {} ({} byte base64)",
                path.display(),
                data_uri.len()
            );
            json!({ "dataUri": data_uri })
        }
        Err(code) => {
            eprintln!("[rustnotes] pick_image ERRORE {code} su {}", path.display());
            json!({ "error": code })
        }
    }))
}

/// Una nota da scrivere su disco nell'export completo. Il frontend ha gia'
/// convertito il contenuto in Markdown (utils/markdown.js): Rust si occupa
/// solo di cartella, nome file e collisioni.
#[derive(serde::Deserialize)]
pub struct ExportFile {
    /// Nome della cartella dell'app che conteneva la nota; `None` per le
    /// note senza cartella, che finiscono nella radice scelta.
    pub folder: Option<String>,
    /// Titolo della nota, da cui deriva il nome file.
    pub name: String,
    pub markdown: String,
}

#[derive(Serialize)]
pub struct ExportAllResult {
    dir: String,
    count: usize,
}

/// Nome file sicuro su tutti i sistemi: via i caratteri riservati (Windows e'
/// il piu' restrittivo), niente punti/spazi in coda, lunghezza limitata,
/// fallback se resta vuoto. Non tocca lettere accentate: sono valide ovunque.
pub fn sanitize_filename(raw: &str, fallback: &str) -> String {
    const RESERVED: &[char] = &['/', '\\', ':', '*', '?', '"', '<', '>', '|', '\0'];
    let cleaned: String = raw
        .chars()
        .map(|c| {
            if RESERVED.contains(&c) || c.is_control() {
                ' '
            } else {
                c
            }
        })
        .collect();
    let cleaned = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    let cleaned = cleaned.trim_end_matches(['.', ' ']).to_string();
    let cleaned: String = cleaned.chars().take(120).collect();
    if cleaned.is_empty() {
        fallback.to_string()
    } else {
        cleaned
    }
}

/// Scrive i file in `root`, una sottocartella per cartella dell'app, e
/// risolve i nomi duplicati con " (2)", " (3)"… come fa il Finder.
pub fn write_export_files(
    root: &Path,
    files: &[ExportFile],
    fallback: &str,
) -> Result<usize, String> {
    use std::collections::HashSet;
    let mut used: HashSet<std::path::PathBuf> = HashSet::new();
    let mut count = 0;
    for f in files {
        let dir = match &f.folder {
            Some(name) => root.join(sanitize_filename(name, fallback)),
            None => root.to_path_buf(),
        };
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let base = sanitize_filename(&f.name, fallback);
        let mut path = dir.join(format!("{base}.md"));
        let mut n = 2;
        while used.contains(&path) || path.exists() {
            path = dir.join(format!("{base} ({n}).md"));
            n += 1;
        }
        std::fs::write(&path, &f.markdown).map_err(|e| e.to_string())?;
        used.insert(path);
        count += 1;
    }
    Ok(count)
}

/// Dialogo nativo di scelta cartella + scrittura di tutte le note come file
/// Markdown. `None` se l'utente annulla.
#[tauri::command]
pub async fn export_all_md(
    app: AppHandle,
    files: Vec<ExportFile>,
    title: Option<String>,
    fallback_name: Option<String>,
) -> Result<Option<ExportAllResult>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title(title.as_deref().unwrap_or("Export all notes"))
        .blocking_pick_folder();

    let Some(dir) = picked else {
        eprintln!("[rustnotes] export_all_md annullato dall'utente");
        return Ok(None);
    };
    let root = dir.into_path().map_err(|e| e.to_string())?;
    let fallback = fallback_name.unwrap_or_else(|| "note".into());
    let count = write_export_files(&root, &files, &fallback)?;
    eprintln!(
        "[rustnotes] export_all_md -> {} ({count} file)",
        root.display()
    );
    Ok(Some(ExportAllResult {
        dir: root.display().to_string(),
        count,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_rimuove_caratteri_riservati_e_normalizza() {
        assert_eq!(
            sanitize_filename("a/b:c*d?e\"f<g>h|i", "x"),
            "a b c d e f g h i"
        );
        assert_eq!(sanitize_filename("  spazi   doppi  ", "x"), "spazi doppi");
        assert_eq!(
            sanitize_filename("fine con punto...", "x"),
            "fine con punto"
        );
        assert_eq!(sanitize_filename("", "fallback"), "fallback");
        assert_eq!(sanitize_filename("///", "fallback"), "fallback");
        assert_eq!(sanitize_filename("perché no", "x"), "perché no");
        assert_eq!(
            sanitize_filename(&"a".repeat(300), "x").chars().count(),
            120
        );
    }

    #[test]
    fn export_scrive_sottocartelle_e_risolve_duplicati() {
        let tmp = tempfile::tempdir().unwrap();
        let files = vec![
            ExportFile {
                folder: None,
                name: "Idea".into(),
                markdown: "# Idea 1".into(),
            },
            ExportFile {
                folder: None,
                name: "Idea".into(),
                markdown: "# Idea 2".into(),
            },
            ExportFile {
                folder: Some("Lavoro".into()),
                name: "".into(),
                markdown: "vuota".into(),
            },
            ExportFile {
                folder: Some("Lavoro".into()),
                name: "Idea".into(),
                markdown: "# Idea 3".into(),
            },
        ];
        let n = write_export_files(tmp.path(), &files, "note").unwrap();
        assert_eq!(n, 4);
        assert_eq!(
            std::fs::read_to_string(tmp.path().join("Idea.md")).unwrap(),
            "# Idea 1"
        );
        assert_eq!(
            std::fs::read_to_string(tmp.path().join("Idea (2).md")).unwrap(),
            "# Idea 2"
        );
        assert_eq!(
            std::fs::read_to_string(tmp.path().join("Lavoro/note.md")).unwrap(),
            "vuota"
        );
        assert_eq!(
            std::fs::read_to_string(tmp.path().join("Lavoro/Idea.md")).unwrap(),
            "# Idea 3"
        );
    }
}

/// Dialogo nativo di scelta cartella, generico: ritorna il percorso o `None`
/// se l'utente annulla. Usato per scegliere la cartella dati.
#[tauri::command]
pub async fn pick_folder(app: AppHandle, title: Option<String>) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title(title.as_deref().unwrap_or("Choose a folder"))
        .blocking_pick_folder();
    let Some(dir) = picked else { return Ok(None) };
    let path = dir.into_path().map_err(|e| e.to_string())?;
    Ok(Some(path.display().to_string()))
}

/// Per un percorso digitato a mano (non scelto dal dialogo sopra).
#[tauri::command]
pub fn read_local_image(file_path: String) -> Value {
    match read_image_as_data_uri(Path::new(&file_path)) {
        Ok(data_uri) => json!({ "dataUri": data_uri }),
        Err(code) => json!({ "error": code }),
    }
}
