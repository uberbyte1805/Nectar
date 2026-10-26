# Implementation plan: Nectar + Nusa feature merge

Date: 2026-10-27
Spec: `docs/superpowers/specs/2026-10-27-nectar-nusa-merge-design.md`

## Phase 0 — Toolchain & fork

1. Install Bun (`npm install -g bun`) and Rust (`rustup-init -y`, MSVC toolchain).
   - Verify: `bun --version`, `cargo --version`.
   - Check MSVC link.exe present (vswhere) before first Tauri build; install
     VS Build Tools C++ workload via winget if missing.
2. Fork `kua8/Nectar` to `uberbyte1805` via `gh repo fork --remote=true`.
3. `bun install` in the clone.
4. Set `CARGO_TARGET_DIR=%LOCALAPPDATA%\cargo-target-nectar` (keep OneDrive clean).
5. Smoke build: `bun run tauri build` (first build downloads the Rust world;
   expect 10–20 min). Install result and confirm dock replaces taskbar,
   then quit Nectar to restore taskbar for the next phase. — *This also
   completes the "replace dock 64" goal early.*

## Phase 1 — Scaffolding for features

6. Read existing mode registry in `src/Overlay.tsx` / `src/main.tsx` /
   `dock-main.tsx`, settings store, and `useSettingsSync`. Add a shared
   `src/data.ts` (typed `data.json` accessor) + Rust `data` module with
   `load/save/prune` and unit tests.
7. Add `settings` sections (`lyrics`, `water`, `shelf`, `todo`) to the Rust
   settings schema with defaults, and tabs/rows in `src/settings`.

## Phase 2 — Features (one at a time, each verifiable in `bun run tauri dev`)

8. **To-do + reminder** (simplest; exercises scheduler + data.json):
   mode component, Rust commands `todo_add/todo_toggle/todo_remove`, due-time
   scheduler event → notch peek + chime.
9. **Water reminder**: mode component with ring + chart, `water_drink` /
   `water_reset` commands, interval scheduler within awake window, snooze.
10. **Lyrics sync**: LRCLIB client in Rust (reqwest, cached per track),
    LRC parser with unit tests, `lyrics_get` command, Lyrics mode UI with
    active-line highlight + click-to-seek through media session.
11. **File shelf**: drag-drop handler on the notch window, shelf mode UI,
    `shelf_add/shelf_remove/shelf_reveal` commands, missing-file state.

## Phase 3 — Release & dock switch

12. `bun run tauri build`; install the NSIS installer.
13. Disable MyDockFinder: stop `Dock_64`/`Dockmod`/`Dockmod64`/`Mydock`,
    remove its autostart entry (keep files at `C:\MyDockFinder`).
14. Launch Nectar, confirm dock + all four modes work; leave Nectar running
    and set "Launch at Login" in its settings.
15. Update fork README with the added features.

## Verification checklist

- [ ] `bun run tauri dev` runs; notch and dock appear.
- [ ] Each of the four new modes renders, persists, and respects its
      settings toggle (live-apply from settings.json without restart).
- [ ] LRC parser unit tests pass (`cargo test`).
- [ ] `data.json` corrupt-file recovery works.
- [ ] Release installer builds and installs; native taskbar hidden while
      Nectar runs, restored on quit.
- [ ] MyDockFinder no longer autostarts; files still on disk.
