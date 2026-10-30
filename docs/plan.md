# Plan: Jira status pill

Implements [`spec.md`](spec.md). Tasks are tracked in [`tasks.md`](tasks.md).

## Stack

| Concern | Choice |
|---------|--------|
| UI | Flutter desktop (Windows, macOS), Dart 3, Material 3 |
| Window | `window_manager` — frameless, always on top, size, position, skip taskbar, drag |
| Tray / menu bar | `tray_manager` 0.5.x (0.6+ is a native rewrite released Sep–Oct 2026; revisit once it matures) |
| Secrets | `flutter_secure_storage` (macOS: legacy Keychain, `usesDataProtectionKeychain: false`) |
| Settings | `shared_preferences` |
| HTTP | `package:http` |
| State | plain `ChangeNotifier` + `ListenableBuilder` (no state-management package) |
| Tests | `flutter_test`, `http/testing.dart` `MockClient` |

## Window model

One native window, two modes, switched by `WindowController`:

- **Pill mode:** 200×36 px, frameless, always on top (user toggle), skip taskbar, not resizable,
  placed at the saved position (clamped to the visible screen area).
- **Panel mode:** 460×600 px, frameless with an in-app header, centered, used for Settings and the
  "what was done" form. Always on top stays on so the form isn't lost behind other windows.
  Closing the panel returns to pill mode at the saved position.

A second native window (`desktop_multi_window`) was rejected: it adds a separate engine per window
and cross-window messaging for no user-visible gain.

macOS: `LSUIElement = true` hides the Dock icon; the menu bar icon is the only entry point.

## Modules (`lib/`)

```
main.dart                  bootstrap: window, tray, services, app
app.dart                   root widget, routes between pill and panel views
core/
  settings.dart            Settings model + SettingsStore (prefs + secure storage)
  pill_state.dart          PillState / PillKind (pure, derived from issue + settings)
jira/
  jira_client.dart         REST calls listed in spec §7, typed errors
  models.dart              Board, BoardColumn, JiraStatus, Issue, Transition
  adf.dart                 plain text → Atlassian Document Format
services/
  task_service.dart        current-task lookup, sticky rule, refresh timer, toggle flow (B1–B4)
window/
  window_controller.dart   pill/panel modes, position persistence, always-on-top
  tray_controller.dart     tray icon + menu (R6)
ui/
  pill.dart                pill widget (R1–R3, spec §5)
  settings_page.dart       settings form (R7)
  done_form.dart           "what was done" form (R4)
```

`TaskService` depends on an abstract `JiraApi` so it can be tested with a fake.

## Toggle flow

```
click pill
 ├─ state = primary   → transition(secondary)
 ├─ state = other     → transition(primary)
 └─ state = secondary → open done form (required text)
                         └─ submit → addComment(text) ──fail──> show error, stay secondary
                                      └─ ok → transition(primary) ──fail──> show Jira error, stay
transition(target): GET transitions → pick to.id == target → POST → refresh
```

Future R5 inserts `addWorklog(started, seconds, text)` between comment and transition.

## Error handling

`JiraException(statusCode, messages)` built from Jira's `errorMessages` / `errors`. 401/403 map to
"check e-mail/token"; network errors to "Jira unreachable". Errors surface in the pill tooltip and,
during the form flow, inline in the form.

## Distribution

GitHub Actions workflow `build.yml`:

- every PR and push: `flutter analyze` + `flutter test` (Ubuntu);
- every PR and push: `flutter build windows --release`, uploads `jira-pill-windows.zip` (portable folder);
- push to `main` and manual dispatch: `flutter build macos --release`, uploads `jira-pill-macos.zip`.
  macOS runners consume 10× minutes on private repos, so they don't run on every PR.

## Delivery

SDD: this spec/plan/tasks set is merged first, then code arrives in PRs that each cite task IDs.
Each PR gets one review by a context-free reviewer agent (Sonnet 5.5) before it is marked ready.
