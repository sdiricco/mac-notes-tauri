//! Porting di updateCheck.js. Come l'originale: nessun download, nessuna
//! installazione automatica — solo un controllo di versione via API pubblica
//! di GitHub Releases. Non serve `electron-updater` né un keypair di firma,
//! perché l'originale non li usava funzionalmente: l'app non è firmata e
//! l'utente si aggiorna da sé.

use serde::Serialize;
use serde_json::Value;

const REPO: &str = "sdiricco/mac-notes-tauri";

#[derive(Debug, Serialize, Clone)]
pub struct UpdateStatus {
    pub available: bool,
    #[serde(rename = "currentVersion")]
    pub current_version: String,
    #[serde(rename = "latestVersion", skip_serializing_if = "Option::is_none")]
    pub latest_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

/// Confronto semver a mano su tre numeri: come l'originale, non serve una
/// libreria dedicata per soli "vX.Y.Z".
fn parse_version(v: &str) -> [u32; 3] {
    let v = v.strip_prefix('v').unwrap_or(v);
    let mut parts = v.split('.').map(|p| p.parse::<u32>().unwrap_or(0));
    [
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
        parts.next().unwrap_or(0),
    ]
}

fn is_newer(a: &str, b: &str) -> bool {
    parse_version(a) > parse_version(b)
}

pub async fn check(current_version: String) -> UpdateStatus {
    let url = format!("https://api.github.com/repos/{REPO}/releases/latest");

    let result = reqwest::Client::new()
        .get(&url)
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "mac-notes-tauri")
        .send()
        .await;

    // Offline o rate limit: nessun problema, si riprova al prossimo giro
    // (stessa scelta dell'originale: fallire in silenzio).
    let Ok(res) = result else {
        return UpdateStatus { available: false, current_version, latest_version: None, url: None };
    };
    if !res.status().is_success() {
        return UpdateStatus { available: false, current_version, latest_version: None, url: None };
    }
    let Ok(data) = res.json::<Value>().await else {
        return UpdateStatus { available: false, current_version, latest_version: None, url: None };
    };

    let tag = data.get("tag_name").and_then(Value::as_str).unwrap_or("");
    let latest = tag.strip_prefix('v').unwrap_or(tag).to_string();
    let html_url = data.get("html_url").and_then(Value::as_str).map(String::from);

    if !latest.is_empty() && is_newer(&latest, &current_version) {
        UpdateStatus {
            available: true,
            current_version,
            latest_version: Some(latest),
            url: html_url,
        }
    } else {
        UpdateStatus { available: false, current_version, latest_version: None, url: None }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn confronta_versioni_semver() {
        assert!(is_newer("1.6.0", "1.5.4"));
        assert!(is_newer("2.0.0", "1.9.9"));
        assert!(!is_newer("1.5.4", "1.5.4"));
        assert!(!is_newer("1.5.3", "1.5.4"));
    }
}
