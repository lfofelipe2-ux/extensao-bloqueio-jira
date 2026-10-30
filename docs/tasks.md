# Tasks

Each PR lists the task IDs it closes. Status: `[ ]` todo · `[x]` done.

## PR 1 — Foundation and pill prototype

- [x] T01 Spec, plan and tasks (`docs/`), `AGENTS.md` with the workflow rules.
- [x] T02 Flutter project for Windows and macOS (`flutter create --platforms=windows,macos`), lints, app id.
- [x] T03 Pill prototype: frameless, always on top, 200×36, drag to move, click vs. drag, saved
      position clamped to the screen, three colors cycling on click (no Jira yet), tray skeleton
      (show/hide, always on top, quit). Validates spec §9.
- [x] T04 CI: analyze + test on Ubuntu; portable Windows zip on every PR; macOS zip on `main` and on demand.

## PR 2 — Jira integration and settings

- [ ] T05 `JiraClient`: myself, boards, board configuration, statuses, board issues, issue, transitions, comment; typed errors; scoped-token base URL.
- [ ] T06 `SettingsStore`: preferences + token in secure storage (legacy Keychain on macOS).
- [ ] T07 Settings page (R7): test connection, board/column/status pickers, only-my-issues, refresh interval.
- [ ] T08 `TaskService`: current task by board rank, sticky rule, periodic refresh (B3), pill state (spec §5).

## PR 3 — Toggle flow and tray

- [ ] T09 Toggle flow: primary → secondary, other → primary, secondary → form → comment → transition (B1, B2, B4).
- [ ] T10 "What was done" form (R4), required, inline errors, panel mode.
- [ ] T11 Tray / menu bar (R6): settings, show/hide pill, always-on-top toggle (persisted), quit. macOS `LSUIElement`.
- [ ] T12 Pill polish: tooltip with summary and errors, busy state, error dot.
- [ ] T13 README: download, first run on macOS (Gatekeeper), creating an API token, settings.

## Later

- [ ] T14 R5 worklog with retroactive start (now / 20 min / custom) before the transition. See spec §8.
- [ ] T15 Code signing / notarization.
