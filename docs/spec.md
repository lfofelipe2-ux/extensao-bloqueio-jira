# Spec: Jira status pill (Flutter desktop)

Status: approved for implementation · Last update: 2026-10-30

## 1. Goal

A desktop app for Windows and macOS, built with Flutter from a single codebase, that shows a small
floating "pill" above every other window. The pill shows the status of the user's current Jira task
and toggles it between a **primary** and a **secondary** status with one click. Distributed as a
portable executable (zip with the app folder on Windows, zipped `.app` on macOS).

## 2. Functional requirements

| ID | Requirement | Scope |
|----|-------------|-------|
| R1 | Small, frameless, always-on-top, draggable pill that remembers its last position. | MVP |
| R2 | Colors: green = primary, orange = secondary, gray = not configured / no task / any other status. Solid background with rounded corners; real window transparency is not required. | MVP |
| R3 | Clicking the pill toggles the task status (primary ⇄ secondary). | MVP |
| R4 | When switching to primary, a form asks what was done while the task was in secondary. The field is required. The text is saved on the task as a **comment**. | MVP |
| R5 | Ask how long the work has been going on: A) starting now, B) 20 min ago, C) custom. The value becomes a worklog with a retroactive start. | **Future** (see §8) |
| R6 | Tray icon (Windows) / menu bar icon (macOS) with: open settings, show/hide pill, toggle always-on-top, quit. | MVP |
| R7 | Settings screen: Jira URL, credentials, board, column, primary and secondary status. | MVP |

## 3. Business rules

- **B1 – Record before transition.** The comment (and later the worklog) is written before the
  transition. If writing fails, the status does not change.
- **B2 – Transition errors.** If the transition fails, show Jira's error message and keep the
  current status.
- **B3 – Periodic refresh.** The pill refreshes its state periodically so changes made directly in
  Jira show up.
- **B4 – No transition path.** If the workflow has no transition from the current status to the
  target status, show an error naming both statuses; nothing is written.

## 4. Task identification

The current task is the **first issue in the configured board column**:

- JQL: `status in (<column status ids>) [AND assignee = currentUser()] ORDER BY Rank ASC`, fetched
  through the board endpoint so the board filter applies.
- **Tie-break: board rank** (`ORDER BY Rank ASC`), the same order the user sees on the board.
  *(Default chosen by the agent; was open in the original spec.)*
- **Only my issues:** setting, default **on**, adds `assignee = currentUser()`. A shared column
  usually holds other people's work too.
- **Sticky task:** if the issue tracked on the previous refresh is still in the primary or secondary
  status, it stays the current task even if it moved out of the column (e.g. the secondary status
  is mapped to another column). Otherwise the first issue of the column is used.

## 5. Pill states

| State | Color | Label | Click |
|-------|-------|-------|-------|
| Not configured | gray | "Configure" | opens settings |
| Loading (first fetch) | gray | "…" | ignored |
| No task in column | gray | "No task" | forces a refresh |
| Task in primary | green | `KEY-1 · <primary status>` | → secondary (no form) |
| Task in secondary | orange | `KEY-1 · <secondary status>` | → primary (form, R4) |
| Task in another status | gray | `KEY-1 · <status>` | → primary (no form) |
| Busy (writing) | current color, dimmed | spinner | ignored |
| Error (network/auth) | gray with red dot | last known label | forces a refresh; tooltip shows the error |

Drag moves the pill; only a click without movement toggles. Hovering shows the issue summary as a tooltip.

## 6. Settings (R7)

| Field | Notes |
|-------|-------|
| Jira site URL | e.g. `https://acme.atlassian.net` |
| E-mail | Atlassian account e-mail |
| API token | stored in the OS secure store, never in plain files |
| Scoped token | checkbox; when on, requests go to `https://api.atlassian.com/ex/jira/{cloudId}` (cloudId read from `<site>/_edge/tenant_info`) |
| Board | picked from the boards list after "Test connection" |
| Column | picked from the board configuration (read-only in Jira) |
| Primary status / Secondary status | picked from the statuses mapped to the board's columns |
| Only my issues | default on |
| Refresh interval | default **60 s**, range 15 s – 10 min *(default chosen by the agent)* |

"Test connection" calls `myself` and shows the account name.

Storage: API token in the OS secure store (Keychain on macOS, Credential Manager–backed store on
Windows via `flutter_secure_storage`). Everything else, plus pill position and visibility, in
`shared_preferences`.

## 7. Jira integration

Auth: **API token** (e-mail + token, HTTP Basic). OAuth 2.0 (3LO) is out of scope.

| Purpose | Endpoint |
|---------|----------|
| Test connection | `GET /rest/api/3/myself` |
| List boards | `GET /rest/agile/1.0/board?startAt=&maxResults=50` |
| Board columns | `GET /rest/agile/1.0/board/{boardId}/configuration` |
| Status names | `GET /rest/api/3/status` |
| Current task | `GET /rest/agile/1.0/board/{boardId}/issue?jql=…&maxResults=1&fields=summary,status` |
| Sticky task check | `GET /rest/api/3/issue/{key}?fields=summary,status` |
| Transitions | `GET /rest/api/3/issue/{key}/transitions` · `POST` same path |
| Comment | `POST /rest/api/3/issue/{key}/comment` (body in Atlassian Document Format) |
| Worklog (future) | `POST /rest/api/3/issue/{key}/worklog` (`started` is required) |

The transition is chosen by its target: the first transition whose `to.id` equals the target status id.

## 8. Future work (not in MVP)

- **R5 worklog with retroactive start.** On switching to primary, the form also asks how long the
  work has been going on (now / 20 min / custom). The app posts a worklog with
  `started = now − offset` and `timeSpentSeconds = offset` (min 60 s), with the comment text as the
  worklog comment, before the transition (B1). Planned as task T14 in `tasks.md`.
- OAuth 2.0 (3LO) login.
- Code signing and notarization on macOS; signing on Windows.

## 9. Risks

- Real window transparency in Flutter desktop still has open issues upstream, so the pill uses a
  solid background in a window sized exactly to the pill.
- macOS: an unsigned app is blocked by Gatekeeper on first open; the user must allow it in System
  Settings → Privacy & Security (documented in README). Using the legacy Keychain
  (`usesDataProtectionKeychain: false`) avoids needing a provisioning profile.
- Windows: `flutter_secure_storage` needs the C++ ATL component of Visual Studio Build Tools to build.
- A pill prototype is built first (task T03) to validate frameless + always-on-top + drag on both OSes
  before the rest.

## 10. Non-goals

Multiple tasks at once, editing board columns, notifications, auto-update, Linux.
