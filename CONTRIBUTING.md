# Contributing to RustNotes

Thanks for stopping by. Issues, bug reports with screenshots (especially from
Windows and Linux, which the author cannot test), translations and small focused
pull requests are all welcome.

## Ground rules

- One change per pull request. A PR that fixes a bug and refactors a component
  is two PRs.
- CI must be green: typecheck, frontend tests, `cargo test`, `cargo clippy`,
  `cargo fmt --check`.
- Behaviour changes need a test where a test is practical (utils, stores, Rust
  logic). UI-only changes need a before/after screenshot in the PR.
- Code comments in the repository are in Italian, from the project's origin.
  New comments may be in English or Italian; do not translate existing ones in
  unrelated PRs. User-facing strings are never hardcoded: see i18n below.

## Layout

```
src/                  Vue 3 frontend (JS, Composition API, Pinia, PrimeVue)
  components/         One file per screen area (Sidebar, NoteList, NoteEditor, QuillEditor, SettingsPage, ...)
  stores/             Pinia stores: notes (data + persistence), settings, ui, updateCheck
  utils/              api.js (bridge to Rust), markdown.js (HTML <-> Markdown), exportAll.js, shortcuts.js
  i18n/               vue-i18n setup + en/ and it/ message files, one per component/domain
  test/setup.js       jsdom stubs for vitest
src-tauri/src/        Rust backend (Tauri v2)
  lib.rs              command registration and app setup
  store.rs            one JSON file per note + folders.json (path-based functions are unit-tested)
  file_transfer.rs    native dialogs: import/export Markdown, export all, images
  menu.rs             native menu with per-language labels
  update_check.rs     GET to GitHub Releases, version comparison
```

The frontend talks to Rust only through `src/utils/api.js`. Each `invoke` there
maps to one `#[tauri::command]` in `lib.rs` or `file_transfer.rs`.

Note and folder objects are untyped JSON on the Rust side on purpose: the schema
lives in `src/stores/notes.js`. Adding a field to a note does not require
touching Rust.

## i18n: adding or changing strings

- Strings live in `src/i18n/en/<domain>.js` and `src/i18n/it/<domain>.js`.
  The domain is the component or area (`list`, `editor`, `settings`, ...). The key
  is `<domain>.<key>`.
- In components: `const { t } = useI18n()` then `t('list.emptyTrash')`.
  Outside components (stores, utils): `import { t } from '../i18n'`.
- Plurals use vue-i18n pipes: `'{count} note | {count} notes'` with `t(key, { count }, count)`.
- Anything computed from labels at module level must be a `computed` so it
  updates when the language changes at runtime.
- English is the fallback: a key missing in another language shows English.
  Every key must exist in `en/`.
- The native menu is built in Rust (`src-tauri/src/menu.rs`) and has its own
  label table, one `Labels` const per language.

### Adding a language

1. Copy `src/i18n/en/` to `src/i18n/<code>/` and translate every file.
2. Import it in `src/i18n/index.js` and add it to `messages`.
3. Add `{ code, name }` to `LOCALES` in the same file (native name, shown as-is
   in every language).
4. Add a `Labels` const, a `match` arm and the code in `SUPPORTED` in
   `src-tauri/src/menu.rs`.

The selector in Settings and the system-locale detection read `LOCALES` in
`src/i18n/index.js`, so steps 1 and 2 are enough for the frontend.

## Running

```bash
pnpm install
pnpm tauri dev          # app with hot reload; Rust changes trigger a rebuild
pnpm test               # vitest (jsdom)
pnpm test:watch
cd src-tauri && cargo test
```

Data in development goes to the same directory as the packaged app (see the
README). Back it up or point the app elsewhere before experimenting with the
storage code.

## Manual test checklist

Native dialogs and menu items cannot be exercised by the unit tests. Before a
release, on each platform you can reach:

- New note, new folder, duplicate, move to folder, trash, restore, empty trash
- Export note as Markdown, import Markdown, insert image, export all notes
- Every native menu item, in both languages
- Cmd/Ctrl+F inside a note opens the in-note find bar; Cmd/Ctrl+Shift+F opens global search
- Light/dark switch, including the native title bar on macOS
- Narrow window: sidebar becomes a drawer, Esc closes it

## Reporting bugs

Include OS and version, app version (Settings → About), what you did, what you
expected, what happened. For rendering problems attach a screenshot. Logs are
printed to the terminal when running `pnpm tauri dev`; every Rust command logs a
line prefixed with `[rustnotes]`.
