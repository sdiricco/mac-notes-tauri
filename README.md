# RustNotes

A simple, local-first notes app in the spirit of Apple Notes, for macOS, Windows and Linux.
Free and open source (MIT), no account, no cloud, no telemetry: your notes are files on your disk.

> **Status: early.** Version 0.9.x. macOS is used daily by the author; Windows and
> Linux builds are produced by CI but have **not yet been run by a human**. See
> [Known limitations](#known-limitations) before you rely on it.

## Features

- Folders, favorites, trash, multi-select, drag to reorder folders
- Rich text editor (Quill) with headings, lists, checklists, code blocks with syntax highlighting, tables, images
- Instant full-text search across all notes, find inside a note
- Markdown import and export, per note or **all notes at once**
- Light and dark theme, follows the system
- Interface in English, Italian, Spanish, French, German, Portuguese, Chinese and Japanese, follows the system language
- Zoom the whole interface in and out (View menu, Cmd/Ctrl + / - / 0), remembered across launches
- Keyboard-first: every action has a shortcut (see Settings → Shortcuts)
- Small: a Tauri v2 app, native webview, a few MB installed

## Install

### macOS (Homebrew)

```bash
brew tap sdiricco/mac-notes
brew install --cask mac-notes-tauri
```

Upgrade with `brew upgrade --cask mac-notes-tauri`.

The app is **not signed with an Apple Developer ID**. On first launch macOS says the
developer cannot be verified. Right-click the app → Open, or from a terminal:

```bash
xattr -dr com.apple.quarantine "/Applications/RustNotes.app"
```

### Windows and Linux

Download the installer for your platform from the
[Releases](https://github.com/sdiricco/mac-notes-tauri/releases) page
(NSIS `.exe` for Windows, `.AppImage` / `.deb` for Linux, x64 and arm64).

Windows will show a SmartScreen warning because the installer is not code-signed.
There is no in-app updater yet: download the new installer at each release.
The app checks GitHub Releases and tells you when a newer version exists.

## Your data

Notes live on your disk, one JSON file per note plus a `folders.json`, in the
platform's application data directory (Settings → About → *Show in Finder* opens it):

| OS | Path |
|---|---|
| macOS | `~/Library/Application Support/io.github.sdiricco.rustnotes/` |
| Windows | `%APPDATA%\io.github.sdiricco.rustnotes\` |
| Linux | `~/.local/share/io.github.sdiricco.rustnotes/` |

Upgrading from a 0.9.x build (then called "Mac Notes Tauri"): the data directory
changed with the name. On first launch the app copies your notes from the old
directory if the new one is empty; the old one is left in place as a backup.

Each note file holds the note's HTML content, title, folder, timestamps and flags.
Images are embedded as data URIs (8 MB limit per image).

You can **move the notes folder anywhere** from Settings → About → Data → *Change…*.
Point it at a folder synced by iCloud Drive, Dropbox or Syncthing and the same
notes are available on every computer that points at it: the app has no sync of
its own, and does not need one. If the folder you pick already contains a
RustNotes archive, the app switches to it instead of moving your current notes
(this is how you connect a second computer). The choice is stored in
`config.json` inside the default directory above. If the chosen folder is missing
at startup (external disk unplugged) the app falls back to the default one.

To get everything out as plain Markdown: Settings → About → **Export all notes**.
It writes one `.md` file per note, one subfolder per folder.

Nothing ever leaves your machine except one anonymous `GET` to the GitHub Releases
API to check for a newer version.

## Known limitations

Documented rather than hidden. Decisions, not oversights:

- **Not code-signed** (macOS Gatekeeper / Windows SmartScreen warnings). Certificates
  cost money every year; the project is free and stays free. Instructions above.
- **Windows and Linux are untested by a human.** They compile in CI. The header is
  designed around macOS traffic lights and may show an empty strip on other OSes.
  Reports and screenshots are very welcome.
- **No auto-update** outside Homebrew. A minisign-based updater (no certificate
  needed) is on the list.
- **No sync of its own.** By design there is no account or server. Put the notes
  folder inside iCloud Drive, Dropbox or Syncthing (see *Your data*). Two
  computers editing the same note at the same time will conflict the way any
  synced file does: last write wins.
- **Storage format is HTML in JSON**, not Markdown files. Markdown is a first-class
  export, not the storage. Switching is under evaluation; the round trip through
  Markdown is lossy for some rich content.
- **Flat folders**, no nesting or tags yet.

## Development

Requirements: Node 20+, pnpm 10, Rust stable, and the
[Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

```bash
pnpm install
pnpm tauri dev
```

Tests and checks (the same ones CI runs on every push and pull request):

```bash
pnpm exec vue-tsc --noEmit   # typecheck
pnpm test                    # frontend unit tests (vitest)
cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings && cargo fmt --check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the layout of the code, how i18n works
and how to add a language.

## Release

Push a tag `vX.Y.Z`. The release workflow builds macOS (universal), Windows
(x64, arm64) and Linux (x64, arm64) and creates a **draft** GitHub release. The
in-app update check reads only the "latest release" endpoint, which ignores drafts:
nobody sees a version until you publish it from the Releases page. Update the
Homebrew cask in the tap at the same time.

## History

RustNotes started as [mac-notes](https://github.com/sdiricco/mac-notes), an
Electron app, and was ported to Tauri v2 with the Vue frontend left almost
untouched and the backend rewritten in Rust. The GitHub repository still carries
the porting-era name `mac-notes-tauri`.

## License

[MIT](LICENSE) © Simone Di Ricco
