import { getBaseUrl, getAuthHeaders } from './auth.js';

const MAX_PAGES = 10;

export class JiraError extends Error {
  constructor({ status, message, kind, jiraMessages = [] }) {
    super(message);
    this.name = 'JiraError';
    this.status = status;
    this.kind = kind;
    this.jiraMessages = jiraMessages;
  }
}

const XSRF_FLAG = 'xsrfWorkaround';
const RULE_ID = 1;
const RULE_USER_AGENT = 'extensao-bloqueio-jira/1';

const dnrAvailable = () => typeof chrome !== 'undefined' && !!chrome.declarativeNetRequest?.updateSessionRules;

async function readFlag() {
  try {
    return !!(await chrome.storage.local.get(XSRF_FLAG))[XSRF_FLAG];
  } catch {
    return false;
  }
}

async function installRule(hostname) {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [RULE_ID],
    addRules: [{
      id: RULE_ID,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'origin', operation: 'remove' },
          { header: 'user-agent', operation: 'set', value: RULE_USER_AGENT },
        ],
      },
      condition: { requestDomains: [hostname], resourceTypes: ['xmlhttprequest'], tabIds: [-1] },
    }],
  });
}

async function attempt(method, url, headers, body) {
  let res;
  let text;
  try {
    res = await fetch(url, {
      method,
      headers,
      credentials: 'omit',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    text = await res.text();
  } catch (e) {
    throw new JiraError({ status: 0, kind: 'network', message: e?.message || 'Network error' });
  }
  return { res, text };
}

async function request(method, path, { query, body } = {}) {
  const base = (await getBaseUrl()).replace(/\/+$/, '');
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const headers = { Accept: 'application/json', ...(await getAuthHeaders()) };
  const isWrite = body !== undefined;
  if (isWrite) {
    headers['Content-Type'] = 'application/json';
    headers['X-Atlassian-Token'] = 'no-check';
  }

  // Jira may reject extension POSTs with "XSRF check failed" because of the browser Origin/User-Agent.
  // Once seen, a scoped DNR rule rewrites both headers; the flag keeps it on across restarts.
  let ruleActive = false;
  if (isWrite && dnrAvailable() && (await readFlag())) {
    try {
      await installRule(url.hostname);
      ruleActive = true;
    } catch {
      // fall through without the rule
    }
  }

  let { res, text } = await attempt(method, url, headers, body);
  let xsrf = isWrite && res.status === 403 && /xsrf/i.test(text);

  if (xsrf && !ruleActive && dnrAvailable()) {
    try {
      await installRule(url.hostname);
      ruleActive = true;
    } catch {
      // keep the original failure
    }
    if (ruleActive) {
      ({ res, text } = await attempt(method, url, headers, body));
      xsrf = res.status === 403 && /xsrf/i.test(text);
      if (res.ok) {
        try {
          await chrome.storage.local.set({ [XSRF_FLAG]: true });
        } catch {
          // best effort
        }
      }
    }
  }

  let data;
  let parseFailed = false;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      parseFailed = true;
    }
  }

  if (!res.ok) {
    const jiraMessages = [
      ...(Array.isArray(data?.errorMessages) ? data.errorMessages : []),
      ...Object.values(data?.errors || {}),
    ];
    throw new JiraError({
      status: res.status,
      kind: !xsrf && (res.status === 401 || res.status === 403) ? 'auth' : 'other',
      message: jiraMessages[0] || (xsrf ? 'XSRF check failed' : `HTTP ${res.status}`),
      jiraMessages,
    });
  }
  if (parseFailed) {
    throw new JiraError({ status: res.status, kind: 'other', message: 'Unexpected non-JSON response' });
  }
  return data;
}

export function getMyself() {
  return request('GET', '/rest/api/3/myself');
}

export async function listBoards() {
  const boards = [];
  let startAt = 0;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await request('GET', '/rest/agile/1.0/board', {
      query: { startAt, maxResults: 50 },
    });
    const values = page?.values || [];
    boards.push(...values);
    if (page?.isLast !== false || values.length === 0) break;
    startAt += values.length;
  }
  return boards;
}

export async function getBoardConfig(boardId) {
  const cfg = await request('GET', `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/configuration`);
  return {
    filterId: cfg?.filter?.id ?? null,
    columns: (cfg?.columnConfig?.columns || []).map((c) => ({
      name: c.name,
      statusIds: (c.statuses || []).map((s) => String(s.id)),
    })),
  };
}

export async function findTasks(settings) {
  const config = await getBoardConfig(settings.boardId);
  const column = config.columns.find((c) => c.name === settings.columnId);
  if (!column || column.statusIds.length === 0) {
    throw new Error(`Column "${settings.columnId}" not found on the board or has no statuses`);
  }

  const statusIds = new Set(column.statusIds);
  const secondaryColumn = config.columns.find((c) => c.statusIds.includes(String(settings.secondaryStatusId)));
  if (secondaryColumn) secondaryColumn.statusIds.forEach((id) => statusIds.add(id));

  const clauses = [];
  if (config.filterId != null) {
    if (!/^\d+$/.test(String(config.filterId))) throw new Error('Unexpected board filter id');
    clauses.push(`filter = ${config.filterId}`);
  }
  clauses.push('assignee = currentUser()', `status in (${[...statusIds].join(', ')})`);
  const jql = clauses.join(' AND ');

  const tasks = [];
  let nextPageToken;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await request('GET', '/rest/api/3/search/jql', {
      query: { jql, fields: 'summary,status', maxResults: 50, nextPageToken },
    });
    for (const issue of res?.issues || []) {
      tasks.push({
        key: issue.key,
        id: issue.id,
        summary: issue.fields?.summary ?? '',
        statusId: issue.fields?.status?.id ?? null,
        statusName: issue.fields?.status?.name ?? '',
      });
    }
    if (res?.isLast !== false || !res?.nextPageToken) break;
    nextPageToken = res.nextPageToken;
  }
  return tasks;
}

export async function getTransitions(key) {
  const res = await request('GET', `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`);
  return res?.transitions || [];
}

export async function transitionTo(key, targetStatusId) {
  const transitions = await getTransitions(key);
  const match = transitions.find((t) => String(t.to?.id) === String(targetStatusId));
  if (!match) {
    throw new JiraError({
      status: 0,
      kind: 'other',
      message: `No transition from the current status of ${key} to status ${targetStatusId}`,
    });
  }
  await request('POST', `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`, {
    body: { transition: { id: match.id } },
  });
}

function toAdf(text) {
  return {
    type: 'doc',
    version: 1,
    content: text.trimEnd().split(/\r?\n/).map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  };
}

export async function addComment(key, text) {
  if (!text || !text.trim()) throw new Error('Comment text is empty');
  return request('POST', `/rest/api/3/issue/${encodeURIComponent(key)}/comment`, {
    body: { body: toAdf(text) },
  });
}
