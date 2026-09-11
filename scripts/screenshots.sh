#!/usr/bin/env bash
# Screenshot riproducibili per README e landing (docs/assets/*.png).
#
# Cosa fa: costruisce (se manca) il bundle release, prepara una cartella dati
# dimostrativa con note in inglese, punta l'app a quella cartella tramite
# config.json (con backup), lancia l'app una volta per scena con i ganci di
# src-tauri/src/demo.rs, cattura la finestra con screencapture, poi ripristina
# config.json e le impostazioni della webview. I tuoi dati non vengono toccati.
#
# Requisiti: macOS, permesso "Registrazione schermo" per il terminale (o per
# l'app che lo esegue), nessuna istanza di RustNotes aperta.
set -euo pipefail
cd "$(dirname "$0")/.."

APP=src-tauri/target/release/bundle/macos/RustNotes.app
BIN="$APP/Contents/MacOS/rustnotes"
CONFIG_DIR="$HOME/Library/Application Support/io.github.sdiricco.rustnotes"
CONFIG="$CONFIG_DIR/config.json"
OUT=docs/assets
DEMO="$(mktemp -d /tmp/rustnotes-demo.XXXXXX)"
BACKUP="$(mktemp /tmp/rustnotes-config-backup.XXXXXX)"
WID_SWIFT="$(mktemp -d /tmp/rustnotes-wid.XXXXXX)/wid.swift"

if pgrep -x rustnotes >/dev/null; then echo "Chiudi RustNotes prima di eseguire lo script."; exit 1; fi
[ -x "$BIN" ] || { echo "Build del bundle release…"; pnpm tauri build --bundles app; }

# --- dati dimostrativi -------------------------------------------------------
mkdir -p "$DEMO/notes"
now=$(( $(date +%s) * 1000 ))
note() { # id folder pinned minutes_ago title html
  local id=$1 folder=$2 pinned=$3 ago=$4 title=$5 html=$6
  local ts=$(( now - ago * 60000 ))
  python3 - "$DEMO/notes/$id.json" "$id" "$folder" "$pinned" "$ts" "$title" "$html" <<'PY'
import json,sys
p,id,folder,pinned,ts,title,html=sys.argv[1:]
json.dump({"id":id,"title":title,"content":html,"folderId":None if folder=="null" else folder,
           "pinned":pinned=="true","trashed":False,"createdAt":int(ts)-86400000,"updatedAt":int(ts)},open(p,'w'),indent=2)
PY
}
cat > "$DEMO/folders.json" <<'JSON'
[
  { "id": "f-work", "name": "Work", "createdAt": 1700000000000 },
  { "id": "f-personal", "name": "Personal", "createdAt": 1700000000001 },
  { "id": "f-ideas", "name": "Ideas", "createdAt": 1700000000002 }
]
JSON
note n-welcome null true 5 "Welcome to RustNotes" \
'<h1>Welcome to RustNotes</h1><p>A simple place for your notes. Everything you write stays on this computer, in files you own. No account, no cloud, no tracking.</p><h2>What you can do</h2><ol><li data-list="bullet">Write with headings, lists, checklists, tables, code blocks and images.</li><li data-list="bullet">Organize notes in folders, mark favorites, find anything with search.</li><li data-list="bullet">Import and export Markdown, one note or all of them at once.</li><li data-list="bullet">Switch language and theme in Settings; the app follows your system by default.</li></ol><h2>Try it now</h2><ol><li data-list="checked">Turn this line into a checked item by clicking the box.</li><li data-list="unchecked">Press the shortcut for a new note (see Settings → Shortcuts).</li><li data-list="unchecked">Open Settings → About → Data to see where your notes live.</li></ol><h2>Your data</h2><p>Each note is a file on your disk. Move the notes folder into iCloud Drive, Dropbox or Syncthing from Settings to use the same notes on several computers.</p>'
note n-release f-work false 40 "Release checklist" \
'<h1>Release checklist</h1><p>Before tagging <strong>v1.4</strong>:</p><ol><li data-list="checked">Changelog written</li><li data-list="checked">Screenshots updated</li><li data-list="unchecked">Run the manual test list on Windows</li><li data-list="unchecked">Bump the Homebrew cask</li></ol><h2>Notes from review</h2><blockquote>The export dialog should remember the last folder.</blockquote><p>Follow up with <em>Anna</em> about the Linux AppImage size.</p>'
note n-sql f-work false 180 "Useful SQL snippets" \
'<h1>Useful SQL snippets</h1><p>Duplicate rows by email:</p><pre data-language="sql">SELECT email, COUNT(*)
FROM users
GROUP BY email
HAVING COUNT(*) &gt; 1;</pre><p>Last 30 days of signups per day:</p><pre data-language="sql">SELECT date_trunc(&#39;day&#39;, created_at) AS day, COUNT(*)
FROM users
WHERE created_at &gt; now() - interval &#39;30 days&#39;
GROUP BY 1 ORDER BY 1;</pre>'
note n-lisbon f-personal true 600 "Lisbon, October" \
'<h1>Lisbon, October</h1><p>Four days, no car. Stay in <strong>Alfama</strong> or <strong>Príncipe Real</strong>.</p><h2>Must do</h2><ol><li data-list="bullet">Tram 28 early in the morning, before the queue</li><li data-list="bullet">Pastéis de Belém, then the monastery next door</li><li data-list="bullet">Sunset at Miradouro de Santa Catarina</li><li data-list="bullet">Day trip to Sintra: Pena palace and the Moorish castle</li></ol><h2>Packing</h2><ol><li data-list="unchecked">Comfortable shoes, the hills are real</li><li data-list="unchecked">Light rain jacket</li><li data-list="checked">Passport renewed</li></ol>'
note n-focaccia f-personal false 2000 "Focaccia" \
'<h1>Focaccia</h1><p>Makes one 30×40 cm tray. Start the day before.</p><table><tbody><tr><td>Flour</td><td>500 g</td></tr><tr><td>Water</td><td>400 g</td></tr><tr><td>Salt</td><td>10 g</td></tr><tr><td>Dry yeast</td><td>3 g</td></tr><tr><td>Olive oil</td><td>40 g + more</td></tr></tbody></table><ol><li data-list="ordered">Mix everything, rest 30 min, fold four times over two hours.</li><li data-list="ordered">Fridge overnight.</li><li data-list="ordered">Oil the tray, stretch the dough, wait until bubbly.</li><li data-list="ordered">Dimple with oily fingers, salt, bake at 230 °C for 22 min.</li></ol>'
note n-app f-ideas false 4300 "App ideas" \
'<h1>App ideas</h1><ol><li data-list="bullet">A timer that only shows how many <em>focused</em> minutes you got today</li><li data-list="bullet">Recipe scaler that understands &quot;a pinch&quot;</li><li data-list="bullet">Read-later that expires links after two weeks, on purpose</li></ol><p>Rule: one weekend each. If it is not fun by Sunday night, drop it.</p>'
note n-books f-ideas false 9000 "Books to read" \
'<h1>Books to read</h1><ol><li data-list="checked">The Design of Everyday Things</li><li data-list="unchecked">A Philosophy of Software Design</li><li data-list="unchecked">Piranesi</li><li data-list="unchecked">The Left Hand of Darkness</li></ol>'

# --- config.json: punta ai dati demo, con ripristino garantito -----------------
mkdir -p "$CONFIG_DIR"
[ -f "$CONFIG" ] && cp "$CONFIG" "$BACKUP" || : > "$BACKUP"
restore() {
  if [ -s "$BACKUP" ]; then cp "$BACKUP" "$CONFIG"; else rm -f "$CONFIG"; fi
  # impostazioni della webview (tema/lingua) come erano prima
  RUSTNOTES_DEMO_RESTORE=1 "$BIN" >/dev/null 2>&1 & pid=$!; sleep 4; kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true
  rm -rf "$DEMO" "$BACKUP" "$(dirname "$WID_SWIFT")"
  echo "Ripristinato config.json e impostazioni."
}
trap restore EXIT
printf '{ "dataDir": "%s", "zoom": 1.0 }\n' "$DEMO" > "$CONFIG"

cat > "$WID_SWIFT" <<'SWIFT'
import CoreGraphics
import Foundation
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as! [[String: Any]]
for w in list {
  let owner = (w["kCGWindowOwnerName"] as? String ?? "").lowercased()
  if owner.hasPrefix("rustnotes") && (w["kCGWindowLayer"] as? Int ?? 1) == 0 { print(w["kCGWindowNumber"] as! Int); break }
}
SWIFT

shoot() { # nome scena settings_json
  local name=$1 settings=$2 scene=${3:-}
  echo "Scena: $name"
  RUSTNOTES_DEMO_SETTINGS="$settings" RUSTNOTES_DEMO_SCENE="$scene" "$BIN" >/dev/null 2>&1 & local pid=$!
  sleep 5
  local wid; wid=$(swift "$WID_SWIFT" 2>/dev/null | tail -1)
  if [[ ! "$wid" =~ ^[0-9]+$ ]]; then
    echo "  finestra non trovata"
  elif screencapture -x -o -l "$wid" "$OUT/$name.png" 2>/dev/null && [ -s "$OUT/$name.png" ]; then
    sips -Z 1800 "$OUT/$name.png" >/dev/null && echo "  -> $OUT/$name.png"
  else
    echo "  cattura negata: concedi 'Registrazione schermo' al terminale (Impostazioni di Sistema > Privacy e sicurezza)"
    rm -f "$OUT/$name.png"
  fi
  kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; sleep 1
}

mkdir -p "$OUT"
shoot editor-light   '{"theme":"light","language":"en"}'
shoot editor-dark    '{"theme":"dark","language":"en"}'
shoot settings-light '{"theme":"light","language":"en"}' settings
shoot search-dark    '{"theme":"dark","language":"en"}'  search
echo "Fatto."
