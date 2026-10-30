# Spec: "Voltar ao trabalho" dialog

## Contract
- Opened by the service worker as a popup: `src/dialog/dialog.html?key=<ISSUE_KEY>`.
- Uses `addComment(key, text)` and `transitionTo(key, targetStatusId)` from `src/lib/jira-client.js`. Both throw `JiraError {status, message, kind: 'auth'|'network'|'other'}`.
- Target status is `settings.primaryStatusId` from `chrome.storage.local["settings"]`.
- On success sends `chrome.runtime.sendMessage({type: 'dialog-done'})` and closes the window.

## Behaviour
1. Text is required; whitespace-only counts as empty. Confirmar stays disabled until there is text.
2. Confirm runs sequentially: comment, then transition (only if the comment succeeded).
3. Comment fails: show the error, keep the text, no transition.
4. Transition fails: show Jira's message, say the comment was already posted, status unchanged. Retry skips the comment (flow state remembers it).
5. Auth error: "Credenciais inválidas ou expiradas" plus a link that opens the options page.
6. Buttons and textarea are disabled while a request is in flight.
7. Cancelar closes the window and changes nothing.
8. Neither the token nor the comment text is ever logged.

## Wireframe
```
+--------------------------------------------+
| Voltar ao trabalho · PROJ-123              |
|                                            |
| O que você fez enquanto a tarefa           |
| estava pausada?                            |
| +----------------------------------------+ |
| |                                        | |
| |                                        | |
| +----------------------------------------+ |
| [erro / aviso, quando houver]              |
|                                            |
| [Cancelar]                     [Confirmar] |
+--------------------------------------------+
```
Rationale: one field and two buttons, forward action on the right as requested. The message area sits between field and buttons so errors are read before retrying. After a transition failure the textarea is locked (comment already posted) and the button label becomes "Tentar novamente".

## Module split
- `src/dialog/flow.js`: pure flow logic, client injected, unit-tested with node:test (`test/dialog-flow.test.js`).
- `src/dialog/dialog.js`: DOM wiring only.
