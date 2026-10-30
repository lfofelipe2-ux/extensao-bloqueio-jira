import { findTasks, transitionTo } from '../lib/jira-client.js';
import { computeRuntime, decideClick, iconPaths, isConfigured, pollPeriodMinutes } from './state.js';

const ALARM = 'poll';
const DIALOG_WINDOW_KEY = 'dialogWindowId';

async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return settings || {};
}

async function getRuntime() {
  const { runtime } = await chrome.storage.local.get('runtime');
  return runtime || null;
}

async function applyRuntime(runtime) {
  await chrome.storage.local.set({ runtime });
  await chrome.action.setIcon({ path: iconPaths(runtime.state) });
  await chrome.action.setTitle({ title: runtime.tooltip });
  await chrome.action.setBadgeText({ text: '' });
}

async function scheduleAlarm() {
  const settings = await getSettings();
  await chrome.alarms.create(ALARM, { periodInMinutes: pollPeriodMinutes(settings.pollSeconds) });
}

async function refresh() {
  const settings = await getSettings();
  const previous = await getRuntime();
  let issues = null;
  let error = null;
  if (isConfigured(settings)) {
    try {
      issues = await findTasks(settings);
    } catch (e) {
      error = { kind: e.kind || 'other', message: e.message };
    }
  }
  await applyRuntime(computeRuntime({ settings, issues, error, previous }));
}

async function showError(message) {
  await chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
  await chrome.action.setBadgeText({ text: '!' });
  await chrome.action.setTitle({ title: `Erro: ${message}` });
}

async function transitionToSecondary(runtime) {
  const settings = await getSettings();
  let failure = null;
  try {
    await transitionTo(runtime.issueKey, settings.secondaryStatusId);
  } catch (e) {
    failure = e.message || 'Falha ao mudar o status';
  }
  await refresh();
  if (failure) await showError(failure);
}

async function openDialog(runtime) {
  const stored = await chrome.storage.local.get(DIALOG_WINDOW_KEY);
  const id = stored[DIALOG_WINDOW_KEY];
  if (id != null) {
    try {
      await chrome.windows.update(id, { focused: true });
      return;
    } catch {
      // window is gone
    }
  }
  const url = chrome.runtime.getURL(
    `src/dialog/dialog.html?key=${encodeURIComponent(runtime.issueKey)}`
  );
  const win = await chrome.windows.create({ url, type: 'popup', width: 480, height: 420 });
  await chrome.storage.local.set({ [DIALOG_WINDOW_KEY]: win.id });
}

async function onClick() {
  const runtime = await getRuntime();
  switch (decideClick(runtime)) {
    case 'transition-secondary':
      return transitionToSecondary(runtime);
    case 'open-dialog':
      return openDialog(runtime);
    case 'open-options':
      return chrome.runtime.openOptionsPage();
    default:
      return refresh();
  }
}

async function start() {
  await scheduleAlarm();
  await refresh();
}

chrome.runtime.onInstalled.addListener(start);
chrome.runtime.onStartup.addListener(start);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) refresh();
});
chrome.action.onClicked.addListener(onClick);
chrome.windows.onRemoved.addListener(async (windowId) => {
  const stored = await chrome.storage.local.get(DIALOG_WINDOW_KEY);
  if (stored[DIALOG_WINDOW_KEY] === windowId) {
    await chrome.storage.local.remove(DIALOG_WINDOW_KEY);
  }
});
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'settings-changed') start();
  else if (message?.type === 'dialog-done') refresh();
});
