import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRuntime, decideClick, iconPaths, isConfigured, pollPeriodMinutes } from './state.js';

const settings = {
  jiraUrl: 'https://x.atlassian.net',
  email: 'a@b.c',
  apiToken: 't',
  boardId: 1,
  columnId: 2,
  primaryStatusId: '10',
  secondaryStatusId: '20',
  pollSeconds: 60,
};
const issue = (statusId, name = 'Doing') => ({
  key: 'ABC-1',
  fields: { summary: 'Fix it', status: { id: statusId, name } },
});

test('isConfigured', () => {
  assert.equal(isConfigured(settings), true);
  assert.equal(isConfigured({ ...settings, apiToken: '' }), false);
  assert.equal(isConfigured(undefined), false);
});

test('pollPeriodMinutes clamps to 30s and defaults to 60s', () => {
  assert.equal(pollPeriodMinutes(10), 0.5);
  assert.equal(pollPeriodMinutes(120), 2);
  assert.equal(pollPeriodMinutes(undefined), 1);
});

test('iconPaths', () => {
  assert.equal(iconPaths('primary')[16], 'icons/green-16.png');
  assert.equal(iconPaths('secondary')[128], 'icons/orange-128.png');
  assert.equal(iconPaths('nope')[32], 'icons/grey-32.png');
});

test('unconfigured is grey', () => {
  const r = computeRuntime({ settings: {}, issues: [] });
  assert.equal(r.state, 'unknown');
  assert.equal(r.reason, 'unconfigured');
});

test('zero and multiple tasks', () => {
  assert.equal(computeRuntime({ settings, issues: [] }).tooltip, 'Nenhuma tarefa na coluna');
  assert.equal(
    computeRuntime({ settings, issues: [issue('10'), issue('20')] }).tooltip,
    'Mais de uma tarefa na coluna'
  );
});

test('single task maps status to state', () => {
  const p = computeRuntime({ settings, issues: [issue('10', 'Em andamento')] });
  assert.equal(p.state, 'primary');
  assert.equal(p.tooltip, 'ABC-1 – Fix it – Em andamento');
  assert.equal(computeRuntime({ settings, issues: [issue(20)] }).state, 'secondary');
  const o = computeRuntime({ settings, issues: [issue('99')] });
  assert.equal(o.state, 'unknown');
  assert.equal(o.reason, 'other-status');
});

test('auth error is grey', () => {
  const r = computeRuntime({ settings, error: { kind: 'auth' } });
  assert.equal(r.state, 'unknown');
  assert.equal(r.reason, 'auth');
  assert.equal(r.tooltip, 'Credenciais inválidas ou expiradas');
});

test('network error keeps last state and marks offline once', () => {
  const previous = computeRuntime({ settings, issues: [issue('10')] });
  const r1 = computeRuntime({ settings, error: { kind: 'network' }, previous });
  assert.equal(r1.state, 'primary');
  assert.equal(r1.offline, true);
  assert.equal(r1.tooltip, 'ABC-1 – Fix it – Doing (offline)');
  const r2 = computeRuntime({ settings, error: { kind: 'network' }, previous: r1 });
  assert.equal(r2.tooltip, r1.tooltip);
});

test('network error without previous is grey', () => {
  assert.equal(computeRuntime({ settings, error: { kind: 'network' } }).state, 'unknown');
});

test('other error is grey with message', () => {
  const r = computeRuntime({ settings, error: { kind: 'other', message: 'boom' } });
  assert.equal(r.reason, 'error');
  assert.match(r.tooltip, /boom/);
});

test('decideClick', () => {
  assert.equal(decideClick({ state: 'primary' }), 'transition-secondary');
  assert.equal(decideClick({ state: 'secondary' }), 'open-dialog');
  assert.equal(decideClick({ state: 'unknown', reason: 'unconfigured' }), 'open-options');
  assert.equal(decideClick({ state: 'unknown', reason: 'auth' }), 'open-options');
  assert.equal(decideClick({ state: 'unknown', reason: 'none' }), 'refresh');
  assert.equal(decideClick(null), 'open-options');
});
