# Options page spec

Slice: `options_ui` page at `src/options/options.html` (plain ES modules, no build). The manifest is owned by another slice and must point `options_ui.page` at this file.

## Contract

Settings live in `chrome.storage.local` under `settings`:
`{jiraUrl, email, apiToken, scopedToken, cloudId, boardId, columnId, primaryStatusId, secondaryStatusId, pollSeconds}`.

Consumed (built by other slices):
- `src/lib/storage.js`: `getSettings()`, `setSettings(patch)`.
- `src/lib/jira-client.js`: `getMyself()`, `listBoards()`, `getBoardConfig(boardId)`; throws `JiraError {status, message, kind}`.

## Behaviour

1. Load saved settings into the form on open.
2. "Testar conexão": validates URL/email/token, requests host permission (`<origin>/*`, plus `https://api.atlassian.com/*` when "Token com escopo" is checked), persists the credential fields, calls `getMyself()` and shows the display name or the error. On success the Board list is loaded with `listBoards()`.
3. Board change loads `getBoardConfig(boardId)`; Column list is filled from its columns. Status lists (Primary/Secondary) offer every status of every column of the board, labelled with the column name.
4. Column change does not reset statuses (the secondary status may sit in another column).
5. Validation on Salvar: URL is https, email and token filled, cloudId required when scoped, board/column/both statuses chosen, primary != secondary, `pollSeconds` integer >= 30.
6. Warning (non-blocking) when a saved status id is not found on the board configuration.
7. Salvar: persists everything, sends `chrome.runtime.sendMessage({type: 'settings-changed'})`, shows "Configurações salvas". Cancelar reloads the saved values.
8. The token is never logged. A notice states that it is stored unencrypted in `chrome.storage.local`.

## Wireframe

```
+--------------------------------------------------+
| Configurações                                    |
| URL do Jira      [https://company.atlassian.net] |
| E-mail           [you@company.com]               |
| Token da API     [••••••••]                      |
|  ! Armazenado sem criptografia neste navegador.  |
| [ ] Token com escopo   Cloud ID [..............] |
| [Testar conexão]  ✓ Conectado como Fulano        |
| ------------------------------------------------ |
| Board            [v Board X                    ] |
| Coluna           [v Em andamento               ] |
| Status primário  [v Em andamento (Em andamento)] |
| Status secundário[v Bloqueado   (Impedimento)  ] |
| Intervalo (s)    [60]  mínimo 30                 |
| ------------------------------------------------ |
| [Cancelar]                              [Salvar] |
+--------------------------------------------------+
```

Rationale: top-to-bottom follows the dependency order (credentials, then board data, then behaviour), later fields stay disabled until their source is loaded, and Cancelar/Salvar follow the left/right rule. Single column keeps it usable in the embedded options pane.
