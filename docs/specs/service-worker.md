# Service worker spec

Slice: `src/background/service-worker.js` and `src/background/state.js`.

## Contract

Reads `settings` and reads/writes `runtime` in `chrome.storage.local` (shapes in the project handoff). The worker keeps no in-memory state between events.

`runtime` gets one additive field, `reason`: `ok | unconfigured | none | multiple | other-status | auth | error`. It tells the click handler why the icon is grey.

Depends on `src/lib/jira-client.js` (`findTasks`, `transitionTo`, `JiraError`), the icons `icons/{grey,green,orange}-{16,32,48,128}.png` and `src/dialog/dialog.html?key=<ISSUE>`.

## state.js (pure, unit tested)

- `isConfigured(settings)`: all of jiraUrl, email, apiToken, boardId, columnId, primaryStatusId, secondaryStatusId are set.
- `pollPeriodMinutes(pollSeconds)`: `max(pollSeconds, 30) / 60`, default 60 s.
- `computeRuntime({ settings, issues, error, previous })`: the icon state machine below.
- `iconPaths(state)`: PNG paths for a state.
- `decideClick(runtime)`: `transition-secondary | open-dialog | open-options | refresh`.

### computeRuntime

| Input | Result |
|---|---|
| not configured | grey, `unconfigured`, "Extensão não configurada" |
| auth error | grey, `auth`, "Credenciais inválidas ou expiradas" |
| network error | previous state/issue kept (unless it was unconfigured/auth, then grey `error`), tooltip gets " (offline)", `offline: true` (grey if no previous) |
| other error | grey, `error`, "Erro ao consultar o Jira: <message>" |
| 0 issues | grey, `none`, "Nenhuma tarefa na coluna" |
| more than 1 | grey, `multiple`, "Mais de uma tarefa na coluna" |
| 1 issue, status = primary | green, tooltip `<KEY> – <summary> – <status>` |
| 1 issue, status = secondary | orange, same tooltip |
| 1 issue, other status | grey, `other-status`, same tooltip |

### decideClick

- primary: `transition-secondary`; secondary: `open-dialog`.
- unknown with reason `unconfigured` or `auth`: `open-options`; otherwise (including no runtime) `refresh`.

## service-worker.js

- Alarm `poll` with `periodInMinutes = pollPeriodMinutes(...)`, recreated on startup, install and the `settings-changed` message. The alarm fires `refresh()`.
- `refresh()`: load settings, `findTasks`, `computeRuntime`, persist `runtime`, `setIcon` and `setTitle`, clear the error badge. Runs on startup, install, every alarm, and after every action.
- Handlers are serialized on one promise chain; a click refreshes first and acts on the fresh state. Fetch `TypeError` without a `kind` counts as network.
- Click on primary: `transitionTo(key, secondaryStatusId)`, then refresh. On failure, refresh and then show the error as badge "!" plus tooltip with Jira's message (this names the missing transition when none exists).
- Click on secondary: open the dialog as a popup window, only one at a time (its window id is kept in storage; an open one is focused instead).
- Messages `settings-changed` (re-arm alarm and refresh) and `dialog-done` (refresh).
- The poll only updates the icon. The token is never logged.

## Out of scope

Jira client, auth, options page, dialog, icons, manifest.
