import { getSettings, setSettings } from '../lib/storage.js';
import { getMyself, listBoards, getBoardConfig } from '../lib/jira-client.js';

const MIN_POLL = 30;
const ids = ['jiraUrl', 'email', 'apiToken', 'scopedToken', 'cloudId', 'boardId', 'columnId',
  'primaryStatusId', 'secondaryStatusId', 'pollSeconds', 'test', 'testResult', 'cloudIdRow',
  'boardWarning', 'formError', 'saved', 'form', 'cancel', 'save'];
const $ = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

let boardConfig = null;
let loadSeq = 0;

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

function origins(c) {
  const list = [`${new URL(c.jiraUrl).origin}/*`];
  if (c.scopedToken) list.push('https://api.atlassian.com/*');
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
  try {
    if (new URL(c.jiraUrl).protocol !== 'https:') throw new Error();
  } catch {
    return 'Informe uma URL válida do Jira começando com https://';
  }
  if (!c.email) return 'Informe o e-mail.';
  if (!c.apiToken) return 'Informe o token da API.';
  if (c.scopedToken && !c.cloudId) return 'Informe o Cloud ID para token com escopo.';
  return null;
}

async function ensurePermission(c) {
  if (await chrome.permissions.contains({ origins: origins(c) })) return;
  const granted = await chrome.permissions.request({ origins: origins(c) });
  if (!granted) throw new Error('Permissão de acesso ao Jira negada.');
}

function statusEntries() {
  if (!boardConfig) return [];
  const seen = new Set();
  return boardConfig.columns.flatMap((col) =>
    (col.statuses || []).filter((s) => !seen.has(String(s.id)) && seen.add(String(s.id)))
      .map((s) => [s.id, `${s.name} (${col.name})`]));
}

function renderBoardFields(saved, warn = false) {
  const columns = boardConfig ? boardConfig.columns : [];
  fillSelect($.columnId, columns.map((c, i) => [c.id ?? c.name ?? i, c.name]), saved.columnId, 'Selecione a coluna');
  const statuses = statusEntries();
  fillSelect($.primaryStatusId, statuses, saved.primaryStatusId, 'Selecione o status primário');
  fillSelect($.secondaryStatusId, statuses, saved.secondaryStatusId, 'Selecione o status secundário');
  const known = new Set(statuses.map(([id]) => String(id)));
  const missing = [saved.primaryStatusId, saved.secondaryStatusId].filter((id) => id && !known.has(String(id)));
  show($.boardWarning, warn && boardConfig && missing.length
    ? 'Um status salvo não pertence a este board. Escolha novamente.' : '');
}

async function loadBoardConfig(boardId, saved, warn = false) {
  const seq = ++loadSeq;
  boardConfig = null;
  renderBoardFields({});
  if (boardId) {
    try {
      const config = await getBoardConfig(boardId);
      if (seq !== loadSeq) return;
      boardConfig = config;
    } catch (e) {
      if (seq !== loadSeq) return;
      show($.formError, `Falha ao carregar o board: ${errorText(e)}`);
    }
  }
  renderBoardFields(saved, warn);
}

async function loadBoards(saved, warn = false) {
  const seq = ++loadSeq;
  const boards = await listBoards();
  if (seq !== loadSeq) return;
  fillSelect($.boardId, boards.map((b) => [b.id, b.name]), saved.boardId,
    boards.length ? 'Selecione o board' : 'Nenhum board encontrado');
  await loadBoardConfig($.boardId.value, saved, warn);
}

function resetBoardData() {
  loadSeq++;
  boardConfig = null;
  fillSelect($.boardId, [], null, 'Teste a conexão primeiro');
  renderBoardFields({});
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
  resetBoardData();
  if (s.jiraUrl && s.email && s.apiToken && s.boardId) {
    try {
      await loadBoards(s, true);
    } catch (e) {
      resetBoardData();
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
  const keep = { boardId: $.boardId.value, ...draft() };
  resetBoardData();
  $.test.disabled = true;
  setResult('Testando...', null);
  try {
    await ensurePermission(c);
    await setSettings(c);
    const me = await getMyself();
    setResult(`Conectado como ${me.displayName}`, true);
  } catch (e) {
    setResult(errorText(e), false);
    $.test.disabled = false;
    return;
  }
  try {
    await loadBoards(keep);
  } catch (e) {
    resetBoardData();
    show($.formError, `Conectado, mas falhou ao listar os boards: ${errorText(e)}`);
  }
  $.test.disabled = false;
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
  if (!Number.isInteger(values.pollSeconds)) return 'Informe o intervalo como número inteiro de segundos.';
  if (values.pollSeconds < MIN_POLL) return `O intervalo mínimo é de ${MIN_POLL} segundos.`;
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
  $.save.disabled = true;
  try {
    await ensurePermission(values);
    await setSettings(values);
    await chrome.runtime.sendMessage({ type: 'settings-changed' }).catch(() => {});
    show($.saved, 'Configurações salvas.');
  } catch (e) {
    show($.formError, `Falha ao salvar: ${errorText(e)}`);
  } finally {
    $.save.disabled = false;
  }
}

$.scopedToken.addEventListener('change', () => { $.cloudIdRow.hidden = !$.scopedToken.checked; });
$.boardId.addEventListener('change', () => { show($.formError, ''); loadBoardConfig($.boardId.value, {}); });
for (const id of ['jiraUrl', 'email', 'apiToken', 'cloudId']) {
  $[id].addEventListener('input', () => { resetBoardData(); setResult('', null); });
}
$.scopedToken.addEventListener('change', () => { resetBoardData(); setResult('', null); });
$.test.addEventListener('click', onTest);
$.cancel.addEventListener('click', populate);
$.form.addEventListener('submit', onSave);

populate();
