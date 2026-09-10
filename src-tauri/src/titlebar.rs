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
    use objc2_app_kit::{NSToolbar, NSWindow, NSWindowToolbarStyle};

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

    if let Some(g) = measure(ns_window) {
        eprintln!(
            "[rustnotes] titlebar: barra {:.0}px, semafori fino a x={:.0}",
            g.height, g.buttons_end
        );
    }
}

/// Geometria della barra del titolo in coordinate CSS (px logici dall'alto e
/// da sinistra). Il frontend la legge all'avvio (comando `titlebar_geometry`)
/// e la mette in variabili CSS: le bande alte quanto la barra e i rientri
/// oltre i semafori seguono cosi' quello che AppKit ha davvero disegnato, che
/// varia con la versione di macOS e con l'SDK con cui il binario e' stato
/// linkato: su macOS 26 la barra compatta e' 38px se il binario e' linkato con
/// l'SDK 15.5 (Xcode locale) e 40px con l'SDK 26.5 (runner di GitHub Actions).
#[derive(serde::Serialize, Clone, Copy)]
pub struct Geometry {
    /// Altezza della barra del titolo.
    pub height: f64,
    /// Bordo destro del terzo semaforo (zoom); 0 dove non ci sono semafori.
    #[serde(rename = "buttonsEnd")]
    pub buttons_end: f64,
}

#[cfg(target_os = "macos")]
fn measure(ns_window: &objc2_app_kit::NSWindow) -> Option<Geometry> {
    use objc2_app_kit::NSWindowButton;
    let close = ns_window.standardWindowButton(NSWindowButton::CloseButton)?;
    let zoom = ns_window.standardWindowButton(NSWindowButton::ZoomButton)?;
    // SAFETY: superview() e' marcata unsafe perche' AppKit non garantisce la
    // validita' del genitore oltre la chiamata; qui il valore viene letto
    // subito e non conservato.
    let height =
        unsafe { close.superview().and_then(|v| v.superview()) }.map(|v| v.frame().size.height)?;
    let z = zoom.frame();
    Some(Geometry {
        height,
        buttons_end: z.origin.x + z.size.width,
    })
}

#[cfg(target_os = "macos")]
pub fn geometry(window: &WebviewWindow) -> Option<Geometry> {
    use objc2_app_kit::NSWindow;
    let ptr = window.ns_window().ok()?;
    objc2::MainThreadMarker::new()?;
    // SAFETY: vedi install().
    let ns_window: &NSWindow = unsafe { &*ptr.cast::<NSWindow>() };
    measure(ns_window)
}

#[cfg(not(target_os = "macos"))]
pub fn geometry(_window: &WebviewWindow) -> Option<Geometry> {
    None
}

#[cfg(not(target_os = "macos"))]
pub fn install(_window: &WebviewWindow) {}
