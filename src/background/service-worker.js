// Stub: replaced by the service-worker slice.
import { getRuntime } from "../lib/storage.js";

chrome.runtime.onInstalled.addListener(async () => {
  await getRuntime();
});
