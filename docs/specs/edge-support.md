# Spec: Microsoft Edge support

## Goal
Document that the extension runs on Microsoft Edge (Chromium) without code changes.

## Decisions
- Edge is Chromium-based and supports Manifest V3 and the `chrome.*` namespace; no code changes.
- Separate release artifact, the Chrome build is unchanged: `npm run zip:edge` writes `dist/jira-status-toggle-edge-<version>.zip` with a manifest generated at build time without `minimum_chrome_version`. `manifest.json` in the repo keeps the key.
- The manifest name and description do not mention "Chrome" (Edge Add-ons certification requires this).
- No `update_url` in the manifest.

## Changes
- `tools/build-zip.mjs`: `--edge` flag; `package.json`: `zip:edge` script.
- `README.md`: browser-neutral wording, `edge://extensions` install step, release zip notes.

## Verification
- Checked once by the author, not in CI: loaded unpacked in Chromium: service worker registers and `chrome.declarativeNetRequest.updateSessionRules` exists.
- Manual check in Edge: icon, polling alarm (30 s minimum) and the "Voltar ao trabalho" popup window.

## Known trade-off
The Edge build has no version floor. An Edge older than Chromium 116 would install it without a check, even though the extension needs a module service worker and `declarativeNetRequestWithHostAccess`. Deliberate, per the request to drop `minimum_chrome_version` from the Edge manifest.
