import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, copyFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'jira-client-'));
copyFileSync(join(here, '../src/lib/jira-client.js'), join(dir, 'jira-client.mjs'));
writeFileSync(
  join(dir, 'auth.js'),
  `export const getBaseUrl = async () => 'https://x.atlassian.net/';
export const getAuthHeaders = async () => ({ Authorization: 'Basic dGVzdA==' });`,
);
const c = await import(pathToFileURL(join(dir, 'jira-client.mjs')));

let calls;
let queue;
let store;
let rules;
const json = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
});

beforeEach(() => {
  calls = [];
  queue = [];
  store = {};
  rules = [];
  globalThis.chrome = {
    storage: { local: { get: async (k) => ({ [k]: store[k] }), set: async (o) => Object.assign(store, o) } },
    declarativeNetRequest: { updateSessionRules: async (o) => rules.push(o) },
  };
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next;
  };
});

test('GET uses auth headers, omit credentials, no XSRF header', async () => {
  queue.push(json(200, { displayName: 'Ana' }));
  assert.deepEqual(await c.getMyself(), { displayName: 'Ana' });
  const { url, init } = calls[0];
  assert.equal(url.href, 'https://x.atlassian.net/rest/api/3/myself');
  assert.equal(init.credentials, 'omit');
  assert.equal(init.headers.Authorization, 'Basic dGVzdA==');
  assert.equal(init.headers.Accept, 'application/json');
  assert.equal(init.headers['X-Atlassian-Token'], undefined);
});

test('listBoards follows paging until isLast', async () => {
  queue.push(json(200, { values: [{ id: 1 }, { id: 2 }], isLast: false }));
  queue.push(json(200, { values: [{ id: 3 }], isLast: true }));
  assert.deepEqual((await c.listBoards()).map((b) => b.id), [1, 2, 3]);
  assert.equal(calls[1].url.searchParams.get('startAt'), '2');
});

test('getBoardConfig maps columns and filter', async () => {
  queue.push(json(200, {
    filter: { id: '10040' },
    columnConfig: { columns: [{ name: 'Doing', statuses: [{ id: '3' }, { id: '4' }] }, { name: 'Empty' }] },
  }));
  assert.deepEqual(await c.getBoardConfig(7), {
    filterId: '10040',
    columns: [{ name: 'Doing', statusIds: ['3', '4'] }, { name: 'Empty', statusIds: [] }],
  });
  assert.equal(calls[0].url.pathname, '/rest/agile/1.0/board/7/configuration');
});

const boardConfig = () => json(200, {
  filter: { id: 55 },
  columnConfig: { columns: [
    { name: 'Doing', statuses: [{ id: '3' }] },
    { name: 'Blocked', statuses: [{ id: '8' }, { id: '9' }] },
  ] },
});
const settings = { boardId: 1, columnId: 'Doing', secondaryStatusId: '8' };

test('findTasks builds JQL with both columns and pages with nextPageToken', async () => {
  queue.push(boardConfig());
  queue.push(json(200, { issues: [{ id: '1', key: 'A-1', fields: { summary: 's1', status: { id: '3', name: 'Doing' } } }], isLast: false, nextPageToken: 'tok' }));
  queue.push(json(200, { issues: [{ id: '2', key: 'A-2', fields: { summary: 's2', status: { id: '8', name: 'Blocked' } } }], isLast: true }));
  const tasks = await c.findTasks(settings);
  assert.deepEqual(tasks.map((t) => t.key), ['A-1', 'A-2']);
  assert.equal(tasks[1].statusId, '8');
  const q = calls[1].url.searchParams;
  assert.equal(q.get('jql'), 'filter = 55 AND assignee = currentUser() AND status in (3, 8, 9)');
  assert.equal(q.get('fields'), 'summary,status');
  assert.equal(q.get('nextPageToken'), null);
  assert.equal(calls[2].url.searchParams.get('nextPageToken'), 'tok');
});

test('findTasks rejects a non-numeric board filter id', async () => {
  queue.push(json(200, { filter: { id: '1 OR 1=1' }, columnConfig: { columns: [{ name: 'Doing', statuses: [{ id: '3' }] }] } }));
  await assert.rejects(c.findTasks(settings), /filter id/);
  assert.equal(calls.length, 1);
});

test('listBoards stops at the page cap', async () => {
  for (let i = 0; i < 20; i++) queue.push(json(200, { values: [{ id: i }], isLast: false }));
  assert.equal((await c.listBoards()).length, 10);
});

test('findTasks returns [] and throws on unknown column', async () => {
  queue.push(boardConfig(), json(200, { issues: [], isLast: true }));
  assert.deepEqual(await c.findTasks(settings), []);
  queue.push(boardConfig());
  await assert.rejects(c.findTasks({ ...settings, columnId: 'Nope' }), /not found/);
});

test('transitionTo picks the transition by to.id', async () => {
  queue.push(json(200, { transitions: [{ id: '11', to: { id: '3' } }, { id: '21', to: { id: '8' } }] }));
  queue.push(json(204));
  await c.transitionTo('A-1', '8');
  assert.equal(calls[1].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].init.body), { transition: { id: '21' } });
  assert.equal(calls[1].init.headers['X-Atlassian-Token'], 'no-check');
  assert.equal(calls[1].init.headers['Content-Type'], 'application/json');
});

test('transitionTo throws naming the missing transition and does not POST', async () => {
  queue.push(json(200, { transitions: [{ id: '11', to: { id: '3' } }] }));
  await assert.rejects(c.transitionTo('A-1', '8'), (e) => e instanceof c.JiraError && /A-1.*8/.test(e.message));
  assert.equal(calls.length, 1);
});

test('addComment sends ADF with one paragraph per line', async () => {
  queue.push(json(201, { id: '1' }));
  await c.addComment('A-1', 'one\r\n\ntwo');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    body: { type: 'doc', version: 1, content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
      { type: 'paragraph', content: [] },
      { type: 'paragraph', content: [{ type: 'text', text: 'two' }] },
    ] },
  });
  await assert.rejects(c.addComment('A-1', '  \n '), /empty/);
  assert.equal(calls.length, 1);
});

test('errors are classified', async () => {
  queue.push(json(401, {}));
  await assert.rejects(c.getMyself(), (e) => e.kind === 'auth' && e.status === 401 && e.message === 'HTTP 401');
  queue.push(json(403, { errorMessages: ['nope'] }));
  await assert.rejects(c.getMyself(), (e) => e.kind === 'auth' && e.message === 'nope');
  queue.push(json(400, { errorMessages: ['bad'], errors: { comment: 'too long' } }));
  await assert.rejects(c.getMyself(), (e) => e.kind === 'other' && e.jiraMessages.join() === 'bad,too long');
  queue.push(new TypeError('Failed to fetch'));
  await assert.rejects(c.getMyself(), (e) => e.kind === 'network' && e.status === 0);
});

test('error never contains the auth header', async () => {
  queue.push(json(401, {}));
  await assert.rejects(c.getMyself(), (e) => !JSON.stringify({ m: e.message, s: e.stack }).includes('dGVzdA'));
});

test('200 with a non-JSON body is an error', async () => {
  queue.push({ ok: true, status: 200, text: async () => '<html>login</html>' });
  await assert.rejects(c.getMyself(), (e) => e.kind === 'other' && /non-JSON/.test(e.message));
});

test('body read failure is a network error', async () => {
  queue.push({ ok: true, status: 200, text: async () => { throw new TypeError('reset'); } });
  await assert.rejects(c.getMyself(), (e) => e.kind === 'network');
});

test('findTasks omits the filter clause when the board has none', async () => {
  queue.push(json(200, { columnConfig: { columns: [{ name: 'Doing', statuses: [{ id: '3' }] }] } }), json(200, { issues: [], isLast: true }));
  await c.findTasks({ boardId: 1, columnId: 'Doing', secondaryStatusId: '99' });
  assert.equal(calls[1].url.searchParams.get('jql'), 'assignee = currentUser() AND status in (3)');
});

const xsrfRes = () => ({ ok: false, status: 403, text: async () => '<html>XSRF check failed</html>' });

test('XSRF 403 on POST installs the DNR rule, retries once and persists the flag', async () => {
  queue.push(xsrfRes(), json(201, { id: '1' }));
  await c.addComment('A-1', 'x');
  assert.equal(calls.length, 2);
  assert.equal(rules.length, 1);
  const rule = rules[0].addRules[0];
  assert.deepEqual(rule.condition, { requestDomains: ['x.atlassian.net'], requestMethods: ['post', 'put', 'delete'], resourceTypes: ['xmlhttprequest'], tabIds: [-1] });
  assert.deepEqual(rule.action.requestHeaders.map((h) => h.header), ['origin', 'user-agent']);
  assert.equal(store.xsrfWorkaround, true);
});

test('with the flag set the rule is installed before the first POST', async () => {
  store.xsrfWorkaround = true;
  queue.push(json(201, {}));
  await c.addComment('A-1', 'x');
  assert.equal(rules.length, 1);
  assert.equal(calls.length, 1);
});

test('GETs never install the rule', async () => {
  store.xsrfWorkaround = true;
  queue.push(json(200, {}));
  await c.getMyself();
  assert.equal(rules.length, 0);
});

test('XSRF failing after the retry is reported as other, not auth, with no loop', async () => {
  queue.push(xsrfRes(), xsrfRes());
  await assert.rejects(c.addComment('A-1', 'x'), (e) => e.kind === 'other' && e.status === 403 && /XSRF/.test(e.message));
  assert.equal(calls.length, 2);
  assert.equal(store.xsrfWorkaround, undefined);
});

test('plain 403 on POST is not retried', async () => {
  queue.push(json(403, { errorMessages: ['no permission'] }));
  await assert.rejects(c.addComment('A-1', 'x'), (e) => e.kind === 'auth');
  assert.equal(calls.length, 1);
  assert.equal(rules.length, 0);
});

test('without declarativeNetRequest the XSRF error surfaces without a retry', async () => {
  delete globalThis.chrome.declarativeNetRequest;
  queue.push(xsrfRes());
  await assert.rejects(c.addComment('A-1', 'x'), (e) => e.kind === 'other');
  assert.equal(calls.length, 1);
});

test('flag is persisted once the retry is no longer an XSRF failure, even if Jira then rejects it', async () => {
  queue.push(xsrfRes(), json(400, { errorMessages: ['bad'] }));
  await assert.rejects(c.addComment('A-1', 'x'), (e) => e.kind === 'other' && e.status === 400);
  assert.equal(store.xsrfWorkaround, true);
});
