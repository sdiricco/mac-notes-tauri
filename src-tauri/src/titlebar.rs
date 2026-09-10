//! Barra del titolo alta su macOS, ottenuta in modo nativo.
//!
//! `trafficLightPosition` di Tauri e' un trucco: tao riposiziona i tre
//! bottoni a mano dentro `drawRect` della vista contenuto, e qualunque evento
//! che fa rifare il layout della barra ad AppKit (cambio aspetto, schermo
//! intero, finestra che torna visibile) li riporta al posto standard finche'
//! la vista non si ridisegna. Con una webview che copre tutto succede di rado:
//! da qui i semafori "che ballano", diversi fra dev e release per pura corsa
//! fra il ridisegno e il layout.
//!
//! La via stabile e' lasciare fare ad AppKit: una NSToolbar vuota con stile
//! `UnifiedCompact` alza la barra del titolo e centra i semafori in verticale,
//! in ogni stato, senza codice nostro. Con `titleBarStyle: Overlay` e
//! `hiddenTitle: true` la toolbar non si vede: cambia solo la geometria. E' la
//! stessa tecnica di `hiddenInset` in Electron.

use tauri::WebviewWindow;

#[cfg(target_os = "macos")]
pub fn install(window: &WebviewWindow) {
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSToolbar, NSWindow, NSWindowButton, NSWindowToolbarStyle};

    let Ok(ptr) = window.ns_window() else { return };
    // setup() gira sul main thread: AppKit lo richiede per toolbar e finestre.
    let Some(mtm) = MainThreadMarker::new() else {
        eprintln!("[rustnotes] titlebar: non sul main thread, salto");
        return;
    };
    // SAFETY: ns_window() restituisce un NSWindow* valido finche' la finestra
    // esiste; qui la finestra e' appena stata creata e siamo sul main thread.
    let ns_window: &NSWindow = unsafe { &*ptr.cast::<NSWindow>() };

    let toolbar = NSToolbar::new(mtm);
    ns_window.setToolbar(Some(&toolbar));
    ns_window.setToolbarStyle(NSWindowToolbarStyle::UnifiedCompact);

    // Geometria risultante, in coordinate dall'alto come nel CSS: e' la misura
    // su cui sono tarati i rientri di .browse-drag (App.vue) e delle bande
    // (NoteList, Sidebar, SettingsPage). Loggata a ogni avvio: se cambia con
    // una versione di macOS lo si vede subito.
    let win_h = ns_window.frame().size.height;
    if let Some(close) = ns_window.standardWindowButton(NSWindowButton::CloseButton) {
        let f = close.frame();
        // SAFETY: superview() e' marcata unsafe perche' AppKit non garantisce
        // la validita' del genitore oltre la chiamata; qui i valori vengono
        // letti subito e non conservati.
        let container_h = unsafe { close.superview().and_then(|v| v.superview()) }
            .map(|v| v.frame().size.height)
            .unwrap_or(0.0);
        // I frame dei bottoni sono relativi al contenitore della barra: il
        // "top" dall'alto della finestra e' altezza barra - (y + altezza).
        let top = container_h - (f.origin.y + f.size.height);
        eprintln!(
            "[rustnotes] titlebar: barra {container_h:.0}px, semaforo rosso x={:.0} top={top:.0} size={:.0} (finestra {win_h:.0}px)",
            f.origin.x, f.size.width
        );
    }
}

#[cfg(not(target_os = "macos"))]
pub fn install(_window: &WebviewWindow) {}
