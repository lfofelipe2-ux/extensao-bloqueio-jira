import { getBaseUrl, getAuthHeaders } from './auth.js';

const MAX_SEARCH_PAGES = 10;

export class JiraError extends Error {
  constructor({ status, message, kind, jiraMessages = [] }) {
    super(message);
    this.name = 'JiraError';
    this.status = status;
    this.kind = kind;
    this.jiraMessages = jiraMessages;
  }
}

async function request(method, path, { query, body } = {}) {
  const base = (await getBaseUrl()).replace(/\/+$/, '');
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }
  const headers = { Accept: 'application/json', ...(await getAuthHeaders()) };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    headers['X-Atlassian-Token'] = 'no-check';
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      credentials: 'omit',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new JiraError({ status: 0, kind: 'network', message: e?.message || 'Network error' });
  }

  const text = await res.text();
  let data;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!res.ok) {
    const jiraMessages = [
      ...(Array.isArray(data?.errorMessages) ? data.errorMessages : []),
      ...Object.values(data?.errors || {}),
    ];
    throw new JiraError({
      status: res.status,
      kind: res.status === 401 || res.status === 403 ? 'auth' : 'other',
      message: jiraMessages[0] || `HTTP ${res.status}`,
      jiraMessages,
    });
  }
  return data;
}

export function getMyself() {
  return request('GET', '/rest/api/3/myself');
}

export async function listBoards() {
  const boards = [];
  let startAt = 0;
  for (;;) {
    const page = await request('GET', '/rest/agile/1.0/board', {
      query: { startAt, maxResults: 50 },
    });
    const values = page?.values || [];
    boards.push(...values);
    if (page?.isLast !== false || values.length === 0) return boards;
    startAt += values.length;
  }
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
  if (config.filterId != null) clauses.push(`filter = ${config.filterId}`);
  clauses.push('assignee = currentUser()', `status in (${[...statusIds].join(', ')})`);
  const jql = clauses.join(' AND ');

  const tasks = [];
  let nextPageToken;
  for (let page = 0; page < MAX_SEARCH_PAGES; page++) {
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
    content: text.split(/\r?\n/).map((line) => ({
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
