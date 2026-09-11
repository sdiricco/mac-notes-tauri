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
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

// Le funzioni pubbliche prendono l'`AppHandle` solo per ricavare la cartella
// dati; la logica vera sta nelle varianti `*_in(root, …)` che lavorano su un
// `Path` qualunque, cosi' i test le esercitano su una cartella temporanea
// senza istanziare Tauri.

/// Cartella dati predefinita, decisa dal sistema (app_data_dir). Contiene
/// sempre `config.json`, anche quando le note vivono altrove: e' l'unico
/// posto che l'app conosce a priori per scoprire dove sono.
fn default_root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

/// Cartella dati effettiva: quella scelta dall'utente se salvata in
/// config.json, altrimenti la predefinita. Letta a ogni operazione e non
/// tenuta in cache: e' un file minuscolo e cosi' non esiste uno stato in
/// memoria da tenere sincronizzato con il disco.
fn app_root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(resolve_root_in(&default_root(app)?))
}

fn config_file_in(default_root: &Path) -> PathBuf {
    default_root.join("config.json")
}

/// config.json come oggetto: vuoto se manca o e' corrotto. Contiene le poche
/// preferenze che devono vivere fuori dalla webview (dataDir, zoom): quelle
/// che Rust deve conoscere prima che il frontend esista.
fn read_config_in(default_root: &Path) -> serde_json::Map<String, Value> {
    fs::read_to_string(config_file_in(default_root))
        .ok()
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default()
}

fn write_config_in(
    default_root: &Path,
    cfg: &serde_json::Map<String, Value>,
) -> Result<(), String> {
    fs::create_dir_all(default_root).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(config_file_in(default_root), text).map_err(|e| e.to_string())
}

pub fn resolve_root_in(default_root: &Path) -> PathBuf {
    let custom = read_config_in(default_root)
        .get("dataDir")
        .and_then(Value::as_str)
        .map(PathBuf::from);
    match custom {
        // Se la cartella scelta e' sparita (disco esterno scollegato, cartella
        // cancellata) si torna alla predefinita invece di fallire ogni
        // operazione: le note li' sono comunque irraggiungibili.
        Some(dir) if dir.is_dir() => dir,
        _ => default_root.to_path_buf(),
    }
}

fn write_data_dir_in(default_root: &Path, data_dir: Option<&Path>) -> Result<(), String> {
    let mut cfg = read_config_in(default_root);
    match data_dir {
        Some(dir) => cfg.insert("dataDir".into(), json!(dir.display().to_string())),
        None => cfg.remove("dataDir"),
    };
    write_config_in(default_root, &cfg)
}

/// Fattore di zoom della webview (1.0 = 100%), letto all'avvio da lib.rs.
pub fn zoom_get(app: &AppHandle) -> f64 {
    default_root(app).map(|r| zoom_get_in(&r)).unwrap_or(1.0)
}

pub fn zoom_get_in(default_root: &Path) -> f64 {
    read_config_in(default_root)
        .get("zoom")
        .and_then(Value::as_f64)
        .unwrap_or(1.0)
}

pub fn zoom_set(app: &AppHandle, factor: f64) -> Result<(), String> {
    zoom_set_in(&default_root(app)?, factor)
}

pub fn zoom_set_in(default_root: &Path, factor: f64) -> Result<(), String> {
    let mut cfg = read_config_in(default_root);
    cfg.insert("zoom".into(), json!(factor));
    write_config_in(default_root, &cfg)
}

/// Identifier dell'app prima della rinomina in RustNotes (v0.9 e precedenti):
/// la cartella dati e' derivata dall'identifier, quindi cambiarlo l'ha
/// spostata. Al primo avvio, se la nuova cartella e' vuota e la vecchia ha
/// note, si copiano (non si spostano: la vecchia resta come backup finche'
/// l'utente non la cancella a mano).
const LEGACY_IDENTIFIER: &str = "com.movesolutions.macnotestauri";

pub fn migrate_legacy(app: &AppHandle) -> Result<Option<usize>, String> {
    let default = default_root(app)?;
    let Some(parent) = default.parent() else {
        return Ok(None);
    };
    migrate_legacy_in(&default, &parent.join(LEGACY_IDENTIFIER))
}

pub fn migrate_legacy_in(default_root: &Path, legacy_root: &Path) -> Result<Option<usize>, String> {
    if !legacy_root.is_dir() || inspect_dir_in(default_root).has_data {
        return Ok(None);
    }
    let legacy = inspect_dir_in(legacy_root);
    if !legacy.has_data {
        return Ok(None);
    }
    ensure_dirs_in(default_root)?;
    let mut count = 0;
    let ffrom = folders_file_in(legacy_root);
    if ffrom.exists() {
        fs::copy(&ffrom, folders_file_in(default_root)).map_err(|e| e.to_string())?;
    }
    if let Ok(rd) = fs::read_dir(notes_dir_in(legacy_root)) {
        for entry in rd.filter_map(Result::ok) {
            let src = entry.path();
            if src.extension().and_then(|x| x.to_str()) != Some("json") {
                continue;
            }
            fs::copy(&src, notes_dir_in(default_root).join(entry.file_name()))
                .map_err(|e| e.to_string())?;
            count += 1;
        }
    }
    Ok(Some(count))
}

#[derive(serde::Serialize)]
pub struct DataDirInfo {
    pub dir: String,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
}

pub fn data_dir_info(app: &AppHandle) -> Result<DataDirInfo, String> {
    let default = default_root(app)?;
    let current = resolve_root_in(&default);
    Ok(DataDirInfo {
        dir: current.display().to_string(),
        is_default: current == default,
    })
}

#[derive(serde::Serialize)]
pub struct DirInspection {
    #[serde(rename = "hasData")]
    pub has_data: bool,
    #[serde(rename = "noteCount")]
    pub note_count: usize,
}

/// Una cartella "contiene dati" se ha un archivio RustNotes riconoscibile:
/// serve a decidere se spostarci le note correnti o adottare quelle che ci
/// sono gia' (il caso del secondo computer che punta alla stessa cartella
/// sincronizzata).
pub fn inspect_dir_in(root: &Path) -> DirInspection {
    let note_count = fs::read_dir(notes_dir_in(root))
        .map(|rd| {
            rd.filter_map(Result::ok)
                .filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("json"))
                .count()
        })
        .unwrap_or(0);
    DirInspection {
        has_data: note_count > 0 || folders_file_in(root).exists(),
        note_count,
    }
}

pub fn inspect_dir(path: &str) -> DirInspection {
    inspect_dir_in(Path::new(path))
}

/// Copia folders.json e notes/*.json da `from` a `to`, poi cancella gli
/// originali. Prima tutte le copie, poi le cancellazioni: se una copia
/// fallisce a meta' i dati originali sono ancora tutti al loro posto.
fn move_data_in(from: &Path, to: &Path) -> Result<usize, String> {
    ensure_dirs_in(to)?;
    let mut copied: Vec<(PathBuf, PathBuf)> = Vec::new();
    let ffrom = folders_file_in(from);
    if ffrom.exists() {
        let fto = folders_file_in(to);
        fs::copy(&ffrom, &fto).map_err(|e| e.to_string())?;
        copied.push((ffrom, fto));
    }
    if let Ok(rd) = fs::read_dir(notes_dir_in(from)) {
        for entry in rd.filter_map(Result::ok) {
            let src = entry.path();
            if src.extension().and_then(|x| x.to_str()) != Some("json") {
                continue;
            }
            let dst = notes_dir_in(to).join(entry.file_name());
            fs::copy(&src, &dst).map_err(|e| e.to_string())?;
            copied.push((src, dst));
        }
    }
    let count = copied.len();
    for (src, _) in copied {
        // Un originale non cancellabile non e' un errore fatale: le note sono
        // gia' al sicuro nella nuova cartella, al massimo resta un duplicato.
        let _ = fs::remove_file(src);
    }
    Ok(count)
}

#[derive(serde::Serialize)]
pub struct SetDataDirResult {
    pub dir: String,
    /// "moved": le note correnti sono state spostate nella nuova cartella.
    /// "adopted": la cartella conteneva gia' un archivio, si usa quello.
    /// "unchanged": era gia' la cartella in uso.
    pub mode: &'static str,
}

/// `target` None = torna alla predefinita.
pub fn set_data_dir_in(
    default_root: &Path,
    target: Option<&Path>,
) -> Result<SetDataDirResult, String> {
    let current = resolve_root_in(default_root);
    let new_root = target
        .map(Path::to_path_buf)
        .unwrap_or_else(|| default_root.to_path_buf());
    if !new_root.is_absolute() {
        return Err("la cartella deve essere un percorso assoluto".into());
    }
    if new_root == current {
        return Ok(SetDataDirResult {
            dir: current.display().to_string(),
            mode: "unchanged",
        });
    }
    if new_root.starts_with(notes_dir_in(&current)) {
        return Err("la cartella scelta e' dentro l'archivio corrente".into());
    }
    let mode = if inspect_dir_in(&new_root).has_data {
        "adopted"
    } else {
        move_data_in(&current, &new_root)?;
        "moved"
    };
    write_data_dir_in(default_root, target)?;
    Ok(SetDataDirResult {
        dir: new_root.display().to_string(),
        mode,
    })
}

pub fn set_data_dir(app: &AppHandle, target: Option<String>) -> Result<SetDataDirResult, String> {
    let default = default_root(app)?;
    set_data_dir_in(&default, target.as_deref().map(Path::new))
}

fn notes_dir_in(root: &Path) -> PathBuf {
    root.join("notes")
}

fn folders_file_in(root: &Path) -> PathBuf {
    root.join("folders.json")
}

fn ensure_dirs_in(root: &Path) -> Result<(), String> {
    let dir = notes_dir_in(root);
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Nome in inglese come segnaposto: al primo avvio il frontend lo rinomina
/// nella lingua dell'utente (vedi notes.js, seedFirstRun), che qui non e'
/// ancora nota.
fn default_folders() -> Value {
    json!([{ "id": uuid_v4(), "name": "Notes", "createdAt": now_ms() }])
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
    load_data_in(&app_root(app)?)
}

pub fn load_data_in(root: &Path) -> Result<Value, String> {
    ensure_dirs_in(root)?;

    let ffile = folders_file_in(root);
    // Primo avvio = archivio mai inizializzato: il frontend ne approfitta per
    // creare la nota di benvenuto e tradurre la cartella di default.
    let first_run = !ffile.exists();
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

    let ndir = notes_dir_in(root);
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

    Ok(json!({ "folders": folders, "notes": notes, "firstRun": first_run }))
}

pub fn save_note(app: &AppHandle, note: &Value) -> Result<(), String> {
    save_note_in(&app_root(app)?, note)
}

pub fn save_note_in(root: &Path, note: &Value) -> Result<(), String> {
    ensure_dirs_in(root)?;
    let id = note
        .get("id")
        .and_then(Value::as_str)
        .ok_or("la nota non ha un campo 'id' valido")?;
    let path = note_path_in(root, id)?;
    let text = serde_json::to_string_pretty(note).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

pub fn delete_note(app: &AppHandle, id: &str) -> Result<(), String> {
    delete_note_in(&app_root(app)?, id)
}

pub fn delete_note_in(root: &Path, id: &str) -> Result<(), String> {
    let path = note_path_in(root, id)?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn save_folders(app: &AppHandle, folders: &Value) -> Result<(), String> {
    save_folders_in(&app_root(app)?, folders)
}

pub fn save_folders_in(root: &Path, folders: &Value) -> Result<(), String> {
    ensure_dirs_in(root)?;
    let path = folders_file_in(root);
    let text = serde_json::to_string_pretty(folders).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

pub fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(notes_dir_in(&app_root(app)?))
}

/// L'id arriva dal frontend e diventa un nome file: va rifiutato tutto cio'
/// che non e' un identificatore semplice, altrimenti un id come "../x"
/// scriverebbe fuori dalla cartella note. Gli id legittimi sono UUID
/// (frontend) o "seed-<hex>" (qui): lettere, cifre e trattini.
fn note_path_in(root: &Path, id: &str) -> Result<PathBuf, String> {
    let valid = !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    if !valid {
        return Err(format!("id nota non valido: {id:?}"));
    }
    Ok(notes_dir_in(root).join(format!("{id}.json")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note(id: &str, title: &str) -> Value {
        json!({ "id": id, "title": title, "content": "", "folderId": null,
                "pinned": false, "trashed": false, "createdAt": 1, "updatedAt": 1 })
    }

    #[test]
    fn primo_avvio_crea_cartella_di_default_e_nessuna_nota() {
        let tmp = tempfile::tempdir().unwrap();
        let data = load_data_in(tmp.path()).unwrap();
        assert_eq!(data["notes"].as_array().unwrap().len(), 0);
        let folders = data["folders"].as_array().unwrap();
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0]["name"], "Notes");
        assert_eq!(data["firstRun"], true);
        assert!(folders_file_in(tmp.path()).exists());
        let again = load_data_in(tmp.path()).unwrap();
        assert_eq!(again["firstRun"], false);
    }

    #[test]
    fn salva_ricarica_ed_elimina_una_nota() {
        let tmp = tempfile::tempdir().unwrap();
        save_note_in(tmp.path(), &note("abc-123", "Ciao")).unwrap();
        let data = load_data_in(tmp.path()).unwrap();
        let notes = data["notes"].as_array().unwrap();
        assert_eq!(notes.len(), 1);
        assert_eq!(notes[0]["title"], "Ciao");

        delete_note_in(tmp.path(), "abc-123").unwrap();
        let data = load_data_in(tmp.path()).unwrap();
        assert_eq!(data["notes"].as_array().unwrap().len(), 0);
        // eliminare due volte non e' un errore
        delete_note_in(tmp.path(), "abc-123").unwrap();
    }

    #[test]
    fn un_file_corrotto_viene_saltato_senza_bloccare_il_caricamento() {
        let tmp = tempfile::tempdir().unwrap();
        save_note_in(tmp.path(), &note("ok-1", "Buona")).unwrap();
        fs::write(notes_dir_in(tmp.path()).join("rotta.json"), "{ non json").unwrap();
        fs::write(notes_dir_in(tmp.path()).join("ignorato.txt"), "x").unwrap();
        let data = load_data_in(tmp.path()).unwrap();
        assert_eq!(data["notes"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn le_cartelle_si_salvano_e_si_rileggono_nello_stesso_ordine() {
        let tmp = tempfile::tempdir().unwrap();
        let folders = json!([{ "id": "b", "name": "Beta" }, { "id": "a", "name": "Alfa" }]);
        save_folders_in(tmp.path(), &folders).unwrap();
        let data = load_data_in(tmp.path()).unwrap();
        assert_eq!(data["folders"], folders);
    }

    #[test]
    fn senza_config_la_radice_e_quella_predefinita() {
        let tmp = tempfile::tempdir().unwrap();
        assert_eq!(resolve_root_in(tmp.path()), tmp.path());
        let info = inspect_dir_in(tmp.path());
        assert!(!info.has_data);
        assert_eq!(info.note_count, 0);
    }

    #[test]
    fn cambiare_cartella_sposta_le_note_e_lascia_vuota_la_vecchia() {
        let default = tempfile::tempdir().unwrap();
        let target = tempfile::tempdir().unwrap();
        save_note_in(default.path(), &note("n-1", "Uno")).unwrap();
        save_note_in(default.path(), &note("n-2", "Due")).unwrap();
        save_folders_in(default.path(), &json!([{ "id": "f", "name": "F" }])).unwrap();

        let res = set_data_dir_in(default.path(), Some(target.path())).unwrap();
        assert_eq!(res.mode, "moved");
        assert_eq!(resolve_root_in(default.path()), target.path());
        assert_eq!(inspect_dir_in(target.path()).note_count, 2);
        assert_eq!(inspect_dir_in(default.path()).note_count, 0);
        assert!(!folders_file_in(default.path()).exists());
        // da qui in avanti le operazioni vanno sulla nuova cartella
        let root = resolve_root_in(default.path());
        save_note_in(&root, &note("n-3", "Tre")).unwrap();
        assert_eq!(
            load_data_in(&root).unwrap()["notes"]
                .as_array()
                .unwrap()
                .len(),
            3
        );
    }

    #[test]
    fn una_cartella_con_archivio_viene_adottata_senza_spostare_nulla() {
        let default = tempfile::tempdir().unwrap();
        let target = tempfile::tempdir().unwrap();
        save_note_in(default.path(), &note("mia", "Mia")).unwrap();
        save_note_in(target.path(), &note("altra", "Altra")).unwrap();

        let res = set_data_dir_in(default.path(), Some(target.path())).unwrap();
        assert_eq!(res.mode, "adopted");
        assert_eq!(inspect_dir_in(target.path()).note_count, 1);
        assert_eq!(
            inspect_dir_in(default.path()).note_count,
            1,
            "le note correnti restano dove sono"
        );
    }

    #[test]
    fn tornare_alla_predefinita_riporta_le_note_e_rimuove_la_scelta() {
        let default = tempfile::tempdir().unwrap();
        let target = tempfile::tempdir().unwrap();
        save_note_in(default.path(), &note("n-1", "Uno")).unwrap();
        set_data_dir_in(default.path(), Some(target.path())).unwrap();

        let res = set_data_dir_in(default.path(), None).unwrap();
        assert_eq!(res.mode, "moved");
        assert_eq!(resolve_root_in(default.path()), default.path());
        assert_eq!(inspect_dir_in(default.path()).note_count, 1);
        assert_eq!(inspect_dir_in(target.path()).note_count, 0);

        let again = set_data_dir_in(default.path(), None).unwrap();
        assert_eq!(again.mode, "unchanged");
    }

    #[test]
    fn cartella_scelta_scomparsa_ricade_sulla_predefinita() {
        let default = tempfile::tempdir().unwrap();
        let gone = default.path().join("esterno");
        fs::create_dir_all(&gone).unwrap();
        set_data_dir_in(default.path(), Some(&gone)).unwrap();
        fs::remove_dir_all(&gone).unwrap();
        assert_eq!(resolve_root_in(default.path()), default.path());
    }

    #[test]
    fn rifiuta_percorsi_relativi_o_dentro_l_archivio() {
        let default = tempfile::tempdir().unwrap();
        assert!(set_data_dir_in(default.path(), Some(Path::new("relativa"))).is_err());
        let inside = notes_dir_in(default.path()).join("sub");
        fs::create_dir_all(&inside).unwrap();
        assert!(set_data_dir_in(default.path(), Some(&inside)).is_err());
    }

    #[test]
    fn migra_le_note_dalla_cartella_del_vecchio_identifier_solo_se_la_nuova_e_vuota() {
        let parent = tempfile::tempdir().unwrap();
        let legacy = parent.path().join("com.movesolutions.macnotestauri");
        let new = parent.path().join("io.github.sdiricco.rustnotes");
        save_note_in(&legacy, &note("v-1", "Vecchia")).unwrap();
        save_folders_in(&legacy, &json!([{ "id": "f", "name": "F" }])).unwrap();

        assert_eq!(migrate_legacy_in(&new, &legacy).unwrap(), Some(1));
        assert_eq!(inspect_dir_in(&new).note_count, 1);
        assert!(folders_file_in(&new).exists());
        assert_eq!(
            inspect_dir_in(&legacy).note_count,
            1,
            "la vecchia resta come backup"
        );

        // seconda volta: la nuova ha gia' dati, non si tocca nulla
        save_note_in(&new, &note("n-2", "Nuova")).unwrap();
        assert_eq!(migrate_legacy_in(&new, &legacy).unwrap(), None);
        assert_eq!(inspect_dir_in(&new).note_count, 2);

        // nessuna cartella vecchia: no-op
        let fresh = parent.path().join("fresh");
        assert_eq!(
            migrate_legacy_in(&fresh, &parent.path().join("inesistente")).unwrap(),
            None
        );
    }

    #[test]
    fn zoom_e_cartella_dati_convivono_nello_stesso_config() {
        let default = tempfile::tempdir().unwrap();
        let target = tempfile::tempdir().unwrap();
        assert_eq!(zoom_get_in(default.path()), 1.0);
        zoom_set_in(default.path(), 1.2).unwrap();
        set_data_dir_in(default.path(), Some(target.path())).unwrap();
        assert_eq!(
            zoom_get_in(default.path()),
            1.2,
            "cambiare cartella non azzera lo zoom"
        );
        assert_eq!(resolve_root_in(default.path()), target.path());
        set_data_dir_in(default.path(), None).unwrap();
        assert_eq!(zoom_get_in(default.path()), 1.2);
        // config corrotto: valori di default, nessun panico
        fs::write(config_file_in(default.path()), "{ rotto").unwrap();
        assert_eq!(zoom_get_in(default.path()), 1.0);
        assert_eq!(resolve_root_in(default.path()), default.path());
    }

    #[test]
    fn id_con_percorso_viene_rifiutato() {
        let tmp = tempfile::tempdir().unwrap();
        assert!(save_note_in(tmp.path(), &note("../evil", "x")).is_err());
        assert!(save_note_in(tmp.path(), &note("a/b", "x")).is_err());
        assert!(delete_note_in(tmp.path(), "").is_err());
        assert!(!tmp.path().join("evil.json").exists());
    }
}
