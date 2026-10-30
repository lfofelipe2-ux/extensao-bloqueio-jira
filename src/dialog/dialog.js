import * as client from '../lib/jira-client.js';
import { createReturnFlow, isBlank } from './flow.js';

const form = document.getElementById('form');
const textEl = document.getElementById('text');
const messageEl = document.getElementById('message');
const confirmBtn = document.getElementById('confirm');
const cancelBtn = document.getElementById('cancel');

const key = new URLSearchParams(location.search).get('key') ?? '';
document.getElementById('key').textContent = key;

let flow;
let busy = false;
let done = false;

function refresh() {
  confirmBtn.disabled = busy || (!flow?.commentPosted && isBlank(textEl.value));
  cancelBtn.disabled = busy;
  textEl.disabled = busy || Boolean(flow?.commentPosted);
}

function showMessage(text, { auth = false } = {}) {
  messageEl.replaceChildren(text);
  if (auth) {
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = 'Abrir configurações';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      chrome.runtime.openOptionsPage();
    });
    messageEl.append(' ', link);
  }
  messageEl.hidden = false;
}

async function getFlow() {
  if (!flow) {
    const { settings } = await chrome.storage.local.get('settings');
    flow = createReturnFlow({ client, primaryStatusId: settings?.primaryStatusId });
  }
  return flow;
}

textEl.addEventListener('input', refresh);
cancelBtn.addEventListener('click', () => window.close());

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || (!flow?.commentPosted && isBlank(textEl.value))) return;
  busy = true;
  messageEl.hidden = true;
  refresh();
  try {
    const result = await (await getFlow()).submit(key, textEl.value);
    if (result.ok) {
      done = true;
      try {
        await chrome.runtime.sendMessage({ type: 'dialog-done' });
      } catch {
        // service worker may be asleep without a listener; the job is done either way
      }
      window.close();
      return;
    }
    if (result.kind === 'config') {
      showMessage(result.message, { auth: true });
    } else if (result.step === 'transition') {
      showMessage(`O comentário já foi publicado, mas a mudança de status falhou: ${result.message}`, { auth: result.kind === 'auth' });
      confirmBtn.textContent = 'Tentar novamente';
    } else {
      showMessage(result.message, { auth: result.kind === 'auth' });
    }
  } catch {
    showMessage('Erro inesperado.');
  } finally {
    if (!done) {
      busy = false;
      refresh();
    }
  }
});

refresh();
