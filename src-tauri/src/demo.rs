//! Ganci per gli screenshot riproducibili (scripts/screenshots.sh). Attivi
//! solo se le variabili d'ambiente sono presenti: in uso normale non fanno
//! nulla. Servono perche' la finestra non si puo' pilotare dall'esterno
//! senza permessi di accessibilita', mentre da dentro l'app basta un eval.
//!
//! - RUSTNOTES_DEMO_SETTINGS: JSON fuso nelle impostazioni salvate della
//!   webview (tema, lingua…), con backup del valore precedente; poi reload.
//! - RUSTNOTES_DEMO_RESTORE=1: ripristina il backup e lo elimina.
//! - RUSTNOTES_DEMO_SCENE: "settings" | "search" apre quella schermata
//!   emettendo lo stesso evento del menu nativo.

use tauri::{AppHandle, Emitter, Manager};

const KEY: &str = "mac-notes-settings";

pub fn install(app: &AppHandle) {
    let settings = std::env::var("RUSTNOTES_DEMO_SETTINGS").ok();
    let restore = std::env::var("RUSTNOTES_DEMO_RESTORE").is_ok();
    let scene = std::env::var("RUSTNOTES_DEMO_SCENE").ok();
    if settings.is_none() && !restore && scene.is_none() {
        return;
    }
    eprintln!("[rustnotes] demo: settings={settings:?} restore={restore} scene={scene:?}");

    let app = app.clone();
    std::thread::spawn(move || {
        // La pagina deve aver caricato: un secondo basta anche in release.
        std::thread::sleep(std::time::Duration::from_millis(1000));
        let js = if restore {
            Some(format!(
                "(()=>{{const b=localStorage.getItem('{KEY}:backup');if(b!==null){{if(b)localStorage.setItem('{KEY}',b);else localStorage.removeItem('{KEY}');localStorage.removeItem('{KEY}:backup');location.reload();}}}})()"
            ))
        } else {
            settings.map(|json| {
                format!(
                    "(()=>{{const k='{KEY}';if(localStorage.getItem(k+':backup')===null)localStorage.setItem(k+':backup',localStorage.getItem(k)||'');const cur=JSON.parse(localStorage.getItem(k)||'{{}}');localStorage.setItem(k,JSON.stringify(Object.assign(cur,{json})));location.reload();}})()"
                )
            })
        };
        if let (Some(js), Some(w)) = (js, app.get_webview_window("main")) {
            let _ = w.eval(&js);
            // il reload ricarica lo store: si aspetta prima della scena
            std::thread::sleep(std::time::Duration::from_millis(1500));
        }
        match scene.as_deref() {
            Some("settings") => {
                let _ = app.emit("menu:settings", ());
            }
            Some("search") => {
                let _ = app.emit("menu:search-all", ());
            }
            _ => {}
        }
    });
}
