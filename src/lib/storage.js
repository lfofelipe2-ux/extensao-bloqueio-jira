export const MIN_POLL_SECONDS = 30;
const DEFAULT_POLL_SECONDS = 60;

export const DEFAULT_SETTINGS = Object.freeze({
  jiraUrl: "",
  email: "",
  apiToken: "",
  scopedToken: false,
  cloudId: "",
  boardId: "",
  columnId: "",
  primaryStatusId: "",
  secondaryStatusId: "",
  pollSeconds: DEFAULT_POLL_SECONDS,
});

export const DEFAULT_RUNTIME = Object.freeze({
  state: "unknown",
  issueKey: "",
  summary: "",
  statusName: "",
  tooltip: "",
  offline: false,
});

function normalizePoll(value) {
  if (value === null || value === "" || typeof value === "boolean") return DEFAULT_POLL_SECONDS;
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_POLL_SECONDS;
  return Math.max(MIN_POLL_SECONDS, Math.round(n));
}

function defined(obj) {
  return Object.fromEntries(Object.entries(obj !== null && typeof obj === "object" ? obj : {}).filter(([, v]) => v !== undefined && v !== null));
}

async function read(key, defaults) {
  const stored = await chrome.storage.local.get(key);
  return { ...defaults, ...defined(stored[key]) };
}

export async function getSettings() {
  const settings = await read("settings", DEFAULT_SETTINGS);
  settings.pollSeconds = normalizePoll(settings.pollSeconds);
  return settings;
}

export async function setSettings(patch) {
  const next = { ...(await getSettings()), ...defined(patch) };
  next.pollSeconds = normalizePoll(next.pollSeconds);
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function getRuntime() {
  return read("runtime", DEFAULT_RUNTIME);
}

export async function setRuntime(patch) {
  const next = { ...(await getRuntime()), ...defined(patch) };
  await chrome.storage.local.set({ runtime: next });
  return next;
}

export function isConfigured(s) {
  const base = [s.jiraUrl, s.email, s.apiToken, s.boardId, s.columnId, s.primaryStatusId, s.secondaryStatusId];
  if (!base.every(Boolean)) return false;
  if (s.primaryStatusId === s.secondaryStatusId) return false;
  if (s.scopedToken && !s.cloudId) return false;
  return true;
}
