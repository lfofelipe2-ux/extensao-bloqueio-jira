import { getSettings, setSettings } from '../lib/storage.js';
import { getMyself, listBoards, getBoardConfig } from '../lib/jira-client.js';

const MIN_POLL = 30;
const ids = ['jiraUrl', 'email', 'apiToken', 'scopedToken', 'cloudId', 'boardId', 'columnId',
  'primaryStatusId', 'secondaryStatusId', 'pollSeconds', 'test', 'testResult', 'cloudIdRow',
  'boardWarning', 'formError', 'saved', 'form', 'cancel'];
const $ = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

let boardConfig = null;

function show(el, text) {
  el.textContent = text ?? '';
  el.hidden = !text;
}

function fillSelect(select, options, selected, placeholder) {
  select.replaceChildren(new Option(placeholder, ''));
  for (const [value, label] of options) select.add(new Option(label, String(value)));
  select.value = selected != null && options.some(([v]) => String(v) === String(selected)) ? String(selected) : '';
  select.disabled = options.length === 0;
}

function errorText(e) {
  return e?.message || 'Erro desconhecido';
}

function origins() {
  const list = [`${new URL($.jiraUrl.value.trim()).origin}/*`];
  if ($.scopedToken.checked) list.push('https://api.atlassian.com/*');
  return list;
}

function readCredentials() {
  return {
    jiraUrl: $.jiraUrl.value.trim().replace(/\/+$/, ''),
    email: $.email.value.trim(),
    apiToken: $.apiToken.value.trim(),
    scopedToken: $.scopedToken.checked,
    cloudId: $.cloudId.value.trim(),
  };
}

function credentialsError(c) {
  if (!/^https:\/\/[^/\s]+/.test(c.jiraUrl)) return 'Informe a URL do Jira começando com https://';
  if (!c.email) return 'Informe o e-mail.';
  if (!c.apiToken) return 'Informe o token da API.';
  if (c.scopedToken && !c.cloudId) return 'Informe o Cloud ID para token com escopo.';
  return null;
}

async function ensurePermission() {
  const granted = await chrome.permissions.request({ origins: origins() });
  if (!granted) throw new Error('Permissão de acesso ao Jira negada.');
}

function statusEntries() {
  if (!boardConfig) return [];
  return boardConfig.columns.flatMap((col) =>
    (col.statuses || []).map((s) => [s.id, `${s.name} (${col.name})`]));
}

function renderBoardFields(saved) {
  const columns = boardConfig ? boardConfig.columns : [];
  fillSelect($.columnId, columns.map((c, i) => [c.id ?? c.name ?? i, c.name]), saved.columnId, 'Selecione a coluna');
  const statuses = statusEntries();
  fillSelect($.primaryStatusId, statuses, saved.primaryStatusId, 'Selecione o status primário');
  fillSelect($.secondaryStatusId, statuses, saved.secondaryStatusId, 'Selecione o status secundário');
  const known = new Set(statuses.map(([id]) => String(id)));
  const missing = [saved.primaryStatusId, saved.secondaryStatusId].filter((id) => id && !known.has(String(id)));
  show($.boardWarning, boardConfig && missing.length
    ? 'Um status salvo não pertence a este board. Escolha novamente.' : '');
}

async function loadBoardConfig(boardId, saved) {
  boardConfig = null;
  if (boardId) {
    try {
      boardConfig = await getBoardConfig(boardId);
    } catch (e) {
      show($.formError, `Falha ao carregar o board: ${errorText(e)}`);
    }
  }
  renderBoardFields(saved);
}

async function loadBoards(saved) {
  const boards = await listBoards();
  fillSelect($.boardId, boards.map((b) => [b.id, b.name]), saved.boardId, 'Selecione o board');
  await loadBoardConfig($.boardId.value, saved);
}

function draft() {
  return {
    columnId: $.columnId.value,
    primaryStatusId: $.primaryStatusId.value,
    secondaryStatusId: $.secondaryStatusId.value,
  };
}

async function populate() {
  const s = await getSettings();
  $.jiraUrl.value = s.jiraUrl || '';
  $.email.value = s.email || '';
  $.apiToken.value = s.apiToken || '';
  $.scopedToken.checked = !!s.scopedToken;
  $.cloudId.value = s.cloudId || '';
  $.cloudIdRow.hidden = !s.scopedToken;
  $.pollSeconds.value = s.pollSeconds || 60;
  show($.testResult, '');
  show($.formError, '');
  show($.saved, '');
  fillSelect($.boardId, [], null, 'Teste a conexão primeiro');
  renderBoardFields({});
  if (s.jiraUrl && s.email && s.apiToken && s.boardId) {
    try {
      await loadBoards(s);
    } catch (e) {
      show($.formError, `Não foi possível carregar os boards: ${errorText(e)}`);
    }
  }
}

async function onTest() {
  show($.formError, '');
  show($.saved, '');
  const c = readCredentials();
  const problem = credentialsError(c);
  if (problem) return setResult(problem, false);
  $.test.disabled = true;
  setResult('Testando...', null);
  try {
    await ensurePermission();
    await setSettings(c);
    const me = await getMyself();
    setResult(`Conectado como ${me.displayName}`, true);
    await loadBoards({ boardId: $.boardId.value, ...draft() });
  } catch (e) {
    setResult(errorText(e), false);
  } finally {
    $.test.disabled = false;
  }
}

function setResult(text, ok) {
  $.testResult.textContent = text;
  $.testResult.className = ok === null ? '' : ok ? 'good' : 'bad';
}

function validate(values) {
  const credProblem = credentialsError(values);
  if (credProblem) return credProblem;
  if (!values.boardId) return 'Selecione o board.';
  if (!values.columnId) return 'Selecione a coluna.';
  if (!values.primaryStatusId || !values.secondaryStatusId) return 'Selecione os status primário e secundário.';
  if (values.primaryStatusId === values.secondaryStatusId) return 'Os status primário e secundário devem ser diferentes.';
  if (!Number.isInteger(values.pollSeconds) || values.pollSeconds < MIN_POLL) {
    return `O intervalo mínimo é de ${MIN_POLL} segundos.`;
  }
  return null;
}

async function onSave(event) {
  event.preventDefault();
  show($.saved, '');
  const values = {
    ...readCredentials(),
    boardId: $.boardId.value,
    columnId: $.columnId.value,
    primaryStatusId: $.primaryStatusId.value,
    secondaryStatusId: $.secondaryStatusId.value,
    pollSeconds: Number($.pollSeconds.value),
  };
  const problem = validate(values);
  if (problem) return show($.formError, problem);
  show($.formError, '');
  try {
    await ensurePermission();
    await setSettings(values);
    await chrome.runtime.sendMessage({ type: 'settings-changed' }).catch(() => {});
    show($.saved, 'Configurações salvas.');
  } catch (e) {
    show($.formError, `Falha ao salvar: ${errorText(e)}`);
  }
}

$.scopedToken.addEventListener('change', () => { $.cloudIdRow.hidden = !$.scopedToken.checked; });
$.boardId.addEventListener('change', () => loadBoardConfig($.boardId.value, draft()));
$.test.addEventListener('click', onTest);
$.cancel.addEventListener('click', populate);
$.form.addEventListener('submit', onSave);

populate();
