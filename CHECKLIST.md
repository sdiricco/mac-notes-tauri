# Checklist di verifica — porting Rust

La finestra è aperta (o riaprila con `pnpm tauri dev`). Verificato finora **solo**
via log: creazione nota, salvataggio, persistenza su disco dopo riavvio.
**Non ancora esercitati**: dialoghi nativi (richiedono un click reale, non posso
automatizzarli) e menu. Ho aggiunto un log per ognuno — guarda il terminale
mentre provi, o dimmi cosa vedi.

## 1. Dialoghi nativi (il punto più a rischio)

Nel codice ho usato le API *blocking* dei dialoghi Tauri dentro comandi
`async`. In teoria potrebbero bloccare il resto dell'app finché il dialogo è
aperto — teoria, non ancora testata.

- [ ] **Esporta come Markdown** — deve apparire il pannello di salvataggio nativo di macOS.
      Log atteso: `export_md -> /percorso/scelto.md`
- [ ] **Importa Markdown** — pannello di apertura file.
      Log atteso: `import_md <- /percorso (N byte)`
- [ ] **Inserisci immagine** nell'editor — pannello di apertura immagine.
      Log atteso: `pick_image -> /percorso (N byte base64)`
- [ ] **Mentre uno di questi pannelli è aperto**, il resto della finestra
      risponde ancora (es. puoi spostarla, il resto dell'interfaccia non è
      congelato)?

Se un pannello non appare o l'app si blocca, fermati e dimmelo: è il segnale
che devo cambiare a `spawn_blocking` o al pattern a canale.

## 2. Menu nativo

Ogni voce ora stampa `menu event: <id>` nel terminale quando cliccata.

- [ ] File → Nuova Nota (anche Cmd+N)
- [ ] File → Nuova Cartella (Cmd+Shift+N)
- [ ] File → Duplica Nota (Cmd+D)
- [ ] Vista → Mostra/Nascondi Sidebar (Cmd+/)
- [ ] Vista → Toolbar → Estesa — la toolbar dell'editor deve effettivamente
      cambiare aspetto, e riaprendo il menu la spunta deve essere su "Estesa"
- [ ] Aiuto → Repository su GitHub — deve aprire il browser

## 3. Un caso dubbio da chiarire: Cmd+F

Nell'originale Electron, Cmd+F è mappato **solo** al menu nativo ("Cerca nelle
note" → mette a fuoco la ricerca nella sidebar). Quill ha anche un suo
binding interno su Cmd+F per la ricerca *dentro* la nota, ma non è
documentato nelle scorciatoie dell'app: è probabile che nell'originale non sia
mai raggiungibile, perché l'acceleratore nativo del menu intercetta il tasto
prima che arrivi al webview.

- [ ] Premi Cmd+F con il cursore dentro una nota: si mette a fuoco la
      ricerca nella sidebar (comportamento atteso, uguale all'originale) o si
      apre la barra di ricerca dentro l'editor (comportamento diverso)?

Qualunque sia il risultato, non è un bug da correggere di corsa — serve solo
a confermare che il porting si comporta come l'originale, non diversamente.

## Cosa NON è ancora verificato (onestà)

- Controllo aggiornamenti (`update_check_run`) — il codice compila e la logica
  ha un test unitario sul confronto di versioni, ma non ho ancora premuto il
  pulsante "Controlla aggiornamenti" nelle Impostazioni con l'app in esecuzione.
- Elimina nota, duplica nota, sposta in cartella — usano `store_save_note` /
  `store_delete_note`, già verificati per il caso base, ma non per ogni varante.
