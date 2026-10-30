# Jira Status Toggle

Browser extension (Manifest V3) for Chrome and Microsoft Edge that shows the status of your current Jira Cloud task in the toolbar icon and switches it between two statuses with one click.

| Icon | State |
|---|---|
| Green | Primary status (working) |
| Orange | Secondary status (paused) |
| Grey | Unknown (not configured, no task, more than one task, or error) |

## Load unpacked

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Microsoft Edge) and enable **Developer mode**.
2. Click **Load unpacked** and select this repository's root folder (the one with `manifest.json`).
3. Open the extension's options page and fill in the Jira URL, email, API token, board, column and statuses.

Edge is Chromium-based and runs the same package unchanged; there is no separate build.

No build step is needed.

## Security note

The API token is stored **unencrypted** in `chrome.storage.local`, on this machine only. Anyone with access to your browser profile can read it. Use a token with the shortest lifetime you can live with and revoke it at id.atlassian.com if the machine is shared or lost. The token is never logged.

## Development

- `npm test` runs the unit tests (Node 22+, no dependencies).
- `npm run icons` regenerates `icons/*.png` from `tools/generate-icons.mjs`.
- Specs live in `docs/specs/`.

## Layout

- `src/lib/`: `storage.js`, `auth.js`, `jira-client.js`
- `src/background/`: service worker and state logic
- `src/options/`: settings page
- `src/dialog/`: "Voltar ao trabalho" dialog
- `spike/`: XSRF spike for POSTs from the service worker
