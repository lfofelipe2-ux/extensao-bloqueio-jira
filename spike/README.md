# Jira XSRF spike

Throwaway extension that checks whether a Manifest V3 service worker can POST a comment and a transition to Jira Cloud. Spec and research: [`docs/specs/spike-xsrf.md`](../docs/specs/spike-xsrf.md).

## Manual steps

1. Create a classic API token at https://id.atlassian.com/manage-profile/security/api-tokens. For the scoped run, create a second token with scopes `read:jira-work` and `write:jira-work`.
2. Pick a test issue where you may comment and transition. Note its key.
3. Open `chrome://extensions`, enable Developer mode, click Load unpacked, select this `spike/` folder.
4. Click the extension icon; the spike page opens in a tab.
5. Fill Jira URL, email, token and issue key. Click **1. Conceder permissão de host** and accept.
6. Click **2. Testar conexão** (reads the issue summary, so it also checks the key and needs only `read:jira-work`). Expect 200.
7. Click **3. Listar transições**; copy the id of a transition on the test issue into "Target transition id".
8. Run the matrix below. For each row set the checkboxes, click **4. Postar comentário**, then **5. Executar transição** (move the issue back by hand between runs, or use a transition id that is valid from the new state).
9. Record the HTTP status and whether `xsrfFailure` is true.

Scoped rows: tick "Token com escopo", do step 1 for the site first, then click **Detectar cloudId** (it fails with a CORS or network error otherwise), then **1.** again so `api.atlassian.com` is granted.

DNR rows: tick "Ativar regra". Start with Origin = remover and User-Agent = substituir; if that fails try Origin = igual à origem do Jira, then each header alone.

The DNR rule is removed after each request. If a rule seems to have no effect, open DevTools on the service worker (chrome://extensions, Inspect views) and check the request headers in the Network tab, or use `chrome://net-export`.

The manifest asks for optional `https://*/*` because the Jira tenant is unknown; the runtime request is limited to the origins you enter (and `api.atlassian.com` for scoped tokens). Remove the extension after the run.

The token is only in the page field and in memory. Close the tab when done and remove the extension.

## Results (fill in)

| # | Token | DNR rule | Comment (status) | Transition (status) | XSRF error? | Notes |
|---|-------|----------|------------------|---------------------|-------------|-------|
| 1 | classic | off | | | | |
| 2 | classic | Origin removed, UA replaced | | | | |
| 3 | classic | Origin = Jira origin, UA kept | | | | |
| 4 | classic | UA replaced only | | | | |
| 5 | scoped | off | | | | |
| 6 | scoped | Origin removed, UA replaced | | | | |

## Expected outcome (research based, unconfirmed)

Rows 1 and 5 should succeed: requests use Basic auth with no cookies, and `X-Atlassian-Token: no-check` is the documented opt-out. Reports of the failure are for Data Center or cookie based sessions; none found for Cloud with `credentials: "omit"`. If row 1 fails with `XSRF check failed`, rows 2 to 4 show which header matters.

## Recommendation for the production extension

- Default: plain `fetch` from the service worker with `credentials: "omit"`, Basic auth and `X-Atlassian-Token: no-check` on POSTs. No `declarativeNetRequest`.
- Keep the request code behind one function so a DNR session rule (remove `Origin`, replace `User-Agent`, scoped to the Jira host and `tabIds: [-1]`) can be added without touching callers, only if the table shows plain `fetch` failing.
- Support both base URLs: site URL for classic tokens, `https://api.atlassian.com/ex/jira/{cloudId}` for scoped tokens, with `cloudId` from `{site}/_edge/tenant_info`.
- Update this section after the table is filled.
