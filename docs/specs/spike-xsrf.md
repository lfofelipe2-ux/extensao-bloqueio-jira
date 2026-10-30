# Spike: Jira Cloud XSRF check on extension POSTs

Status: draft. Scope: `spike/` only (throwaway, not production code).

## Question

Can a Manifest V3 service worker post a comment and run a transition on Jira Cloud using
`fetch` with Basic auth (email + API token) and `X-Atlassian-Token: no-check`, or does Jira
answer `403 XSRF check failed`?

## Research (2026-10-30)

Sources:
- Atlassian KB, [REST API calls with a browser User-Agent header may fail CSRF checks](https://support.atlassian.com/jira/kb/rest-api-calls-with-a-browser-user-agent-header-may-fail-csrf-checks/): a browser `User-Agent` triggers extra XSRF checks; the KB says it applies to Data Center only. Workaround: drop the `User-Agent`, or send an `Origin`/`Referer` equal to the Jira origin or to an allowlisted origin.
- Developer community, [REST API request fails with "XSRF check failed"](https://community.developer.atlassian.com/t/rest-api-request-fails-with-xsrf-check-failed/22025): same request works from Insomnia, fails with the Chrome UA; `X-Atlassian-Token: no-check` plus matching Origin/Referer did not help the extension author; suggestion to allowlist the extension origin (`chrome-extension://<id>`) in Jira.
- [Toggl-to-Jira Chrome extension issue 10](https://github.com/fyyyyy/Toggl-to-Jira-Chrome-Extension/issues/10): its XSRF failures were session-cookie related, not token related (not directly comparable).
- Scoped tokens: [community thread](https://community.developer.atlassian.com/t/using-personal-access-token-to-access-issue-in-jira-cloud-from-cli-util/91915) and [mcp-atlassian issue 968](https://github.com/sooperset/mcp-atlassian/issues/968): scoped tokens use Basic auth against `https://api.atlassian.com/ex/jira/{cloudId}/...`; the site URL returns 401/404 for them; `cloudId` is readable from `{site}/_edge/tenant_info`.

Not found: any report confirming the failure on Jira Cloud with a pure service-worker `fetch` and `credentials: "omit"`. All hard evidence is Data Center or cookie based. Atlassian's KB mentions allowlisting an origin, which is a Data Center admin feature and unavailable to us on Cloud.

## Expected outcome (hypothesis, to be confirmed by the manual run)

1. Plain `fetch` from the service worker with Basic auth and `credentials: "omit"` works: Basic-auth requests without a session cookie are exempt from XSRF on Jira Cloud, and `X-Atlassian-Token: no-check` is the documented opt-out.
2. If it fails with `XSRF check failed`, the cause is the browser-set `Origin` (`chrome-extension://...`) and `User-Agent`; the declarativeNetRequest variant (remove `Origin`, replace `User-Agent`, or set `Origin` to the Jira origin) should fix it.
3. Scoped tokens work only through the gateway; the settings page must support both base URLs.

## Design

Unpacked MV3 extension in `spike/`:
- `manifest.json`: `action`, service worker, permissions `declarativeNetRequest`, `declarativeNetRequestWithHostAccess`; `optional_host_permissions: ["https://*/*"]`.
- `spike.html` + `spike.js`: opened by the toolbar icon. Fields: Jira URL, email, API token, issue key, transition id, scoped-token checkbox + cloudId, DNR mode checkbox with Origin and User-Agent choices. Buttons: request host permission, detect cloudId, test connection, list transitions, post comment, run transition.
- `background.js`: receives messages, builds requests, applies or clears a session DNR rule, returns `{status, ok, body}`. The token lives only in the message and in memory; it is never stored, logged or echoed.
- DNR rule: session rule, `requestDomains` = request host, `tabIds: [-1]` (extension-initiated requests), `xmlhttprequest` only.
- Requests: `credentials: "omit"`, `Authorization: Basic`, `X-Atlassian-Token: no-check` on POSTs, comment body in ADF.

## Acceptance

- README gives exact steps and a results table covering: classic token plain, classic + DNR, scoped plain, scoped + DNR, for comment and transition.
- Token never appears in logs, storage, or the repository.
- Recommendation for production is recorded in `spike/README.md` and updated after the run.
