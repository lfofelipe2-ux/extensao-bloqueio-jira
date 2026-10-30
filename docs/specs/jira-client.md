# Spec: Jira client (`src/lib/jira-client.js`)

Thin wrapper over the Jira Cloud REST API used by the background worker and the options page. No credentials in signatures: base URL and headers come from `auth.js` (`getBaseUrl()`, `getAuthHeaders()`, both awaited).

## Endpoints (verified against current Atlassian docs)

| Function | Call | Notes |
|---|---|---|
| `getMyself()` | `GET /rest/api/3/myself` | |
| `listBoards()` | `GET /rest/agile/1.0/board?startAt&maxResults=50` | Offset paging; response `{values, isLast, startAt, maxResults, total}`. Loops until `isLast`. Returns `values`. |
| `getBoardConfig(boardId)` | `GET /rest/agile/1.0/board/{id}/configuration` | Returns `{ filterId, columns: [{ name, statusIds: [] }] }` from `filter.id` and `columnConfig.columns[].statuses[].id` (status ids are strings). Columns have no id; `name` identifies a column. |
| `findTasks(settings)` | `GET /rest/api/3/search/jql` | See below. |
| `getTransitions(key)` | `GET /rest/api/3/issue/{key}/transitions` | Returns `transitions[]` (`id`, `name`, `to.id`). |
| `transitionTo(key, statusId)` | `POST /rest/api/3/issue/{key}/transitions` body `{transition:{id}}` | 204. |
| `addComment(key, text)` | `POST /rest/api/3/issue/{key}/comment` body `{body: <ADF>}` | 201. |

### Search (`/rest/api/3/search/jql`)

- The old `/rest/api/3/search` is deprecated/removed. The enhanced endpoint has no `total` or `startAt`; it pages with `nextPageToken` and ends on `isLast: true`.
- `fields` must be requested explicitly (default is id only): `summary,status`.
- JQL must be bounded; `assignee = currentUser()` bounds it.
- `findTasks` reads the board config, takes the status ids of the column named `settings.columnId`, adds the ids of the column holding `settings.secondaryStatusId` when it is another column, and builds
  `filter = <board filter id> AND assignee = currentUser() AND status in (<ids>)`.
  The board filter limits results to the board. Returns all matches as `{ key, id, summary, statusId, statusName }` so the caller can detect 0 or more than 1. Pages are followed (max 10).
- Throws a plain `Error` if the column is not found on the board or has no statuses.

## Transitions

`transitionTo` fetches the available transitions and picks the one whose `to.id` equals the target. If none exists it throws `JiraError` (`kind: 'other'`) naming the issue and target status id ("No transition from the current status to status X"). It never chains transitions.

## Comments

ADF: `{type:'doc',version:1,content:[paragraph...]}`, one paragraph per line (`\r\n` and `\n`); blank lines become empty paragraphs. Blank text is rejected before any request.

## Errors

`JiraError extends Error` with `status` (0 for network), `message`, `kind` and `jiraMessages`.
- `auth`: HTTP 401 or 403.
- `network`: `fetch` rejected.
- `other`: everything else.
`jiraMessages` is `errorMessages` plus the values of `errors` from the Jira body. The message prefers the first Jira message, falling back to `HTTP <status>`. Headers are never included in errors or logged.

## Requests

`credentials: 'omit'`, `Accept: application/json`, and for POSTs `Content-Type: application/json` and `X-Atlassian-Token: no-check`. Auth headers come from `auth.js`.

## Tests

`test/jira-client.test.mjs` (`node --test`) mocks `globalThis.fetch` and uses a temporary auth stub; nothing is shipped.

## Sources

- Issue search (enhanced): https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/
- Search and reconcile: https://developer.atlassian.com/cloud/jira/platform/search-and-reconcile/
- Board API: https://developer.atlassian.com/cloud/jira/software/rest/api-group-board/
