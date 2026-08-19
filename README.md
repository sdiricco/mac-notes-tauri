# mac-notes-tauri

Porting di [mac-notes](https://github.com/sdiricco/mac-notes) da Electron a
Tauri v2. Frontend Vue **invariato** (a parte un file), backend riscritto in
Rust.

## Stato

**Verificato via log + file su disco**: crea/salva/carica note, persistenza
identica all'originale (una nota per file JSON in
`~/Library/Application Support/<identifier>/notes/`), sopravvive al riavvio.

**Compila e gira, non ancora esercitato manualmente**: dialoghi nativi
(export/import markdown, scelta immagine — richiedono un click reale, non
automatizzabile da qui) e menu nativo. Vedi [CHECKLIST.md](CHECKLIST.md) per
cosa provare e perché proprio quei punti contano (uno in particolare: i
dialoghi usano l'API *blocking* di Tauri dentro comandi `async`, un pattern
comune ma non ancora verificato empiricamente su questa versione).

## Cosa è stato portato

| Originale (Electron) | Qui (Tauri) | File |
|---|---|---|
| `src/main/store.js` | `store.rs` | comandi `store_*` |
| `src/main/fileTransfer.js` | `file_transfer.rs` | `export_md`, `import_md`, `pick_image`, `read_local_image` |
| `src/main/menu.js` | `menu.rs` | menu nativo via `tauri::menu` |
| `src/main/updateCheck.js` | `update_check.rs` | stessa logica: solo GET pubblico a GitHub Releases, nessun keypair |
| `src/preload/index.js` + `utils/api.js` | `utils/api.js` (riscritto) | unico file frontend toccato |
| `src/renderer/src/**` | `src/**` | **copiato verbatim**, zero righe modificate |

## Gap noti, dichiarati non nascosti

- **Menu → Vista**: Reload / Toggle DevTools / Zoom in-out-reset non hanno un
  `PredefinedMenuItem` equivalente in Tauri (sono `role` Electron legati alla
  `BrowserWindow`). Omessi per ora.
- **Menu → Finestra**: "Porta tutto in primo piano" (`role: front`) omesso,
  non ha equivalente diretto.
- **Nessuna migrazione dati**: le note esistenti in mac-notes (Electron) non
  vengono importate. Identifier diverso (`com.movesolutions.macnotestauri`)
  → cartella dati diversa. Deciso esplicitamente: non interessa in questa fase.
- **Immagini come data URI**, non asset protocol Tauri: portato identico
  all'originale per zero modifiche al frontend. Da rivalutare — l'asset
  protocol eliminerebbe il limite di 8 MB.

## Editor in WKWebView

Prima di questo porting è stato verificato separatamente se Quill si comporta
bene in WKWebView (vedi `../editor-spike`). Risultato: sì, alla prova pratica.

## Installazione (macOS, via Homebrew)

Stesso meccanismo di [mac-notes](https://github.com/sdiricco/mac-notes): un
cask nel tap personale, aggiornamento manuale da terminale, nessun
autoupdater — il controllo versione in-app (`update_check.rs`) si limita ad
avvisare che è disponibile una nuova release.

```bash
brew tap sdiricco/mac-notes
brew install --cask mac-notes-tauri
```

Aggiornamento:

```bash
brew upgrade --cask mac-notes-tauri
```

L'app non è firmata con un certificato Apple Developer ID: al primo avvio
macOS mostra "sviluppatore non verificato". Tasto destro sull'app → Apri,
oppure da terminale:

```bash
xattr -dr com.apple.quarantine "/Applications/Mac Notes Tauri.app"
```

## Windows e Linux

Le build sono generate automaticamente dalla stessa release (installer NSIS
per Windows, AppImage/deb per Linux — vedi
[Releases](https://github.com/sdiricco/mac-notes-tauri/releases)), ma **non
sono ancora state aperte su queste piattaforme**: compilano, non sono
verificate. Nessun meccanismo di aggiornamento da terminale per ora — vanno
scaricate a mano a ogni versione.

## Sviluppo

```bash
source "$HOME/.cargo/env" && pnpm tauri dev
```

Release: pusha un tag `vX.Y.Z` — la pipeline builda tutte le piattaforme e
crea una **release in bozza** (`releaseDraft: true`). Il controllo
aggiornamenti in-app legge solo l'endpoint "latest release" di GitHub, che
ignora le bozze: finché non la pubblichi a mano dalla pagina Releases, nessun
utente la vede. Prima di pubblicare, aggiorna anche il Cask (vedi sotto).
