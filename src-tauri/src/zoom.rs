//! Zoom dell'interfaccia (menu Vista: Ingrandisci / Riduci / Dimensione
//! effettiva). Usa lo zoom nativo della webview (`set_zoom`: pageZoom su
//! WKWebView, ZoomFactor su WebView2, zoom_level su WebKitGTK), che scala
//! tutto come lo zoom di un browser, invece di uno `zoom` CSS che in WebKit
//! sposta gli overlay posizionati con getBoundingClientRect. Il livello e'
//! persistito in config.json (store.rs) e riapplicato all'avvio.

use tauri::{AppHandle, Manager};

const STEP: f64 = 0.1;
const MIN: f64 = 0.5;
const MAX: f64 = 2.0;

fn clamp(factor: f64) -> f64 {
    // Arrotonda al decimo: sommare 0.1 in virgola mobile produce 1.2000000000000002.
    ((factor.clamp(MIN, MAX)) * 10.0).round() / 10.0
}

pub fn apply(app: &AppHandle, factor: f64) {
    let factor = clamp(factor);
    if let Some(window) = app.get_webview_window("main") {
        if let Err(e) = window.set_zoom(factor) {
            eprintln!("[rustnotes] zoom ERRORE: {e}");
            return;
        }
    }
    if let Err(e) = crate::store::zoom_set(app, factor) {
        eprintln!("[rustnotes] zoom non salvato: {e}");
    }
}

pub fn bump(app: &AppHandle, direction: f64) {
    apply(app, crate::store::zoom_get(app) + direction * STEP);
}

pub fn reset(app: &AppHandle) {
    apply(app, 1.0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_limita_e_arrotonda() {
        assert_eq!(clamp(1.0 + 0.1 + 0.1), 1.2);
        assert_eq!(clamp(3.0), MAX);
        assert_eq!(clamp(0.1), MIN);
        assert_eq!(clamp(0.95), 1.0);
    }
}
