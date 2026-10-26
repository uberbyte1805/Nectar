# Design: Nectar + Nusa feature merge

Date: 2026-10-27
Status: Approved
Owner: uberbyte1805

## Goal

Fork `kua8/Nectar` (a Tauri v2 + React notch-and-dock app for Windows) and add
the four signature features of `rama2555/nusa` (a Windows "living notch" app
whose landing page is the only public artifact): synced lyrics, water
reminder, file shelf, and to-do with reminders. The result stays branded as
"Nectar" and replaces the user's current dock (MyDockFinder, `Dock_64.exe`) on
this Windows machine.

## Context

- `nusa` repo = static landing page only (`index.html`, 678 KB, marketing
  copy + animated mockup). No application source exists. The features below
  are re-implementations of what the landing page advertises, built on top of
  Nectar's codebase, not ports of Nusa code.
- Nectar v1.4.0 already provides: notch with Music / Command Center / Status /
  Calendar modes, a dock that mirrors and replaces the Windows taskbar, media
  session control via COM, audio via WASAPI, hardware via WMI, a live-watched
  `settings.json`, per-monitor placement, themes, and a chime mechanism for
  timer completion.
- Machine state: MyDockFinder installed at `C:\MyDockFinder` and running
  (`Dock_64.exe`, `Dockmod`, `Dockmod64`, `Mydock` processes). Rust and Bun
  are not installed; Node.js v24 and npm are. GitHub CLI is authenticated as
  `uberbyte1805`.

## Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Base codebase | Fork Nectar | Dock, notch shell, and Windows integration are already mature; re-implementing them is out of scope. |
| Features to add | All four Nusa features | User selected lyrics sync, water reminder, file shelf, to-do + reminders. |
| Branding | Keep "Nectar" | Minimal churn: icons, tray name, About text, and updater stay untouched. |
| Existing dock | Disable MyDockFinder (do not uninstall) | Autorun off + processes stopped; reversible if the user wants it back. |
| Toolchain | Install Rust (rustup + MSVC) and Bun | Required to build Nectar from source. |
| Rust build target dir | Redirect `target/` out of the OneDrive-synced working directory to `%LOCALAPPDATA%` | Multi-GB build artifacts must not be synced by OneDrive. |

## Architecture

The fork keeps Nectar's existing structure:

- `src/` — React UI. One component file per notch mode already exists
  (`Overlay.tsx`, `Calendar.tsx`, `CompactMediaPlayer.tsx`, etc.), plus
  `settings/` tabs. Each new feature adds one mode component and, where
  needed, one settings tab.
- `src-tauri/` — Rust backend. Existing modules handle media session, audio,
  WMI monitoring, taskbar hiding, dock window(s), and the settings watcher.
  New features add commands and a scheduler.
- `settings.json` — single live-watched config. Each feature adds its own
  section. Secrets and per-user data (shelf entries, to-do items, water log)
  go to a separate `data.json` in the same app-data directory, since
  `settings.json` is treated as user-editable configuration.

### Feature: Lyrics sync

- New notch mode "Lyrics", reachable by scrolling the notch (same gesture as
  existing mode switching) and by a lyrics button in the Music layout.
- Lyrics source: LRCLIB public API (`https://lrclib.net/api/search` and
  `https://lrclib.net/api/get`), queried with the current media session's
  track title, artist, and duration. No API key required.
- Response mapping: enhanced/plain LRC text is parsed into
  `{ timeMs, text }[]` client-side; playback position already exposed by the
  media session backend drives the active-line highlight and scroll.
- Click a line: seek media session to that timestamp (backend command via
  existing COM session interface).
- Failure handling: on network error, no match, or instrumental track, the
  mode shows track title/artist only with a dim "No lyrics found" note. No
  modal, no retry loop; next track change re-queries. Results cached per
  `trackId` in memory for the session.
- Settings section: `lyrics: { enabled, fontSize, autoMode }`.

### Feature: Water reminder

- New notch mode "Water": daily goal in ml (default 1500), current total,
  "Drink" button (+250 ml default, configurable), 7-day bar chart, and a
  streak line mirroring the landing-page mockup copy.
- Persistence: `data.json → waterLog: { "2026-10-27": 1500, ... }`, pruned to
  the last 30 days on load.
- Reminder: backend scheduler fires every `intervalMinutes` (default 60)
  during a configurable awake window (default 09:00–21:00 local). When it
  fires and the day's total is below goal, the notch peeks with the prompt
  and chime. Dismiss or drink; "Snooze" pushes the next reminder by 15
  minutes. No firing while total ≥ goal.
- Settings section: `water: { enabled, goalMl, incrementMl, intervalMinutes,
  awakeStart, awakeEnd }`.

### Feature: File shelf

- New notch mode "Shelf": a horizontal strip of pinned file chips (name +
  icon), matching the "Shelf" idea on the Nusa landing page.
- Add: drag a file onto the notch (Nectar already ships the Tauri drag
  plugin); the chip stores the absolute path, display name, and an optional
  snapshot thumbnail for images.
- Remove: drag the chip out of the notch — the file is copied to the drop
  target when the OS reports one (email attach, chat), otherwise opens
  Explorer with the file selected. Right-click chip → Remove / Show in
  Explorer.
- Persistence: `data.json → shelf: [{ path, name, addedAt }]`. On load,
  missing files render as a dimmed "missing" chip instead of being silently
  dropped.
- Settings section: `shelf: { enabled, maxItems }`.

### Feature: To-do + reminder

- New notch mode "To-do": list of tasks with optional due time; add via an
  inline input in the notch.
- Persistence: `data.json → todos: [{ id, text, dueAt, done }]`. Overdue
  undone items are visually marked; completed items collapse into a count.
- Reminder: same backend scheduler as water. When `dueAt` passes, notch
  peeks with the task text + chime, reusing the timer-chime path. Once per
  task (a `notified` flag on the item).
- Settings section: `todo: { enabled }`.

### Dock transition

1. Before installing the fork build: stop MyDockFinder processes
   (`Dock_64`, `Dockmod`, `Dockmod64`, `Mydock`) and disable its autostart
   entry (Run key / StartupTask as found on the machine). The install at
   `C:\MyDockFinder` is left in place.
2. `bun run tauri build` produces the NSIS installer; install it. On launch
   Nectar hides the native taskbar and shows its dock — same pinned apps,
   same order, imported on first run.
3. Rollback path: run Nectar's uninstall (restores the native taskbar), then
   re-enable MyDockFinder autostart to return to the previous state.

## Data flow

```
media session (COM) ──> lyrics query (LRCLIB) ──> parsed lines ──> notch highlight
settings.json (live-watched) ──> feature toggles/sizes
data.json (app data dir) ──> waterLog / shelf / todos
backend scheduler ──> due events (water interval, todo dueAt) ──> notch peek + chime
```

## Error handling

- LRCLIB unreachable / no match: silent degradation to title-only display.
- `data.json` corrupt or missing: recreate empty and log once to the Rust
  log; never crash the notch.
- Scheduler only runs while the app runs; a missed window is skipped (no
  catch-up pile of reminders on next start).
- Shelf chip whose file was deleted: shown dimmed, removable, never blocks
  load.

## Testing

- Per feature: run `bun run tauri dev`, exercise the mode manually against a
  real media session (browser tab playing music), a real drag-drop for the
  shelf, and fabricated due times for reminders.
- Settings round-trip: edit `settings.json` while running and confirm the
  live watcher applies each new section without restart.
- Dock transition: after install, confirm native taskbar hidden, dock shows
  pinned apps, and Nectar quit restores the taskbar (existing behavior).
- Rust unit tests for LRC parser and `data.json` load/prune logic.

## Out of scope

- Rebranding (stays "Nectar").
- Building the real "Nusa" app (its source is not public).
- Notch mascot/pet mode from the Nusa mockup.
- Multi-machine sync of shelf/todos/water data.
- Uninstalling MyDockFinder.
