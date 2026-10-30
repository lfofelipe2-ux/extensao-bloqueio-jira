# Spec: Microsoft Edge support

## Goal
Document that the extension runs on Microsoft Edge (Chromium) without code changes.

## Decisions
- Same package for Chrome and Edge. Edge is Chromium-based and supports Manifest V3 and the `chrome.*` namespace.
- `minimum_chrome_version` stays in `manifest.json`: Chromium-based browsers ignore it when unsupported, and no source shows it blocking Edge.
- The manifest name and description do not mention "Chrome" (Edge Add-ons certification requires this).
- No `update_url` in the manifest.

## Changes
- `README.md`: browser-neutral wording and `edge://extensions` install step.

## Verification
- Loaded unpacked in Chromium: service worker registers and `chrome.declarativeNetRequest.updateSessionRules` exists.
- Manual check in Edge: icon, polling alarm (30 s minimum) and the "Voltar ao trabalho" popup window.
