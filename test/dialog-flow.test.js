import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReturnFlow, isBlank, AUTH_MESSAGE } from '../src/dialog/flow.js';

function makeClient({ commentError, transitionError } = {}) {
  const calls = [];
  return {
    calls,
    async addComment(key, text) {
      calls.push(['comment', key, text]);
      if (commentError) throw commentError;
    },
    async transitionTo(key, id) {
      calls.push(['transition', key, id]);
      if (transitionError) throw transitionError;
    },
  };
}

test('isBlank treats empty and whitespace as blank', () => {
  assert.equal(isBlank(''), true);
  assert.equal(isBlank('  \n\t'), true);
  assert.equal(isBlank(undefined), true);
  assert.equal(isBlank(' x '), false);
});

test('empty text calls nothing', async () => {
  const client = makeClient();
  const flow = createReturnFlow({ client, primaryStatusId: '10' });
  const result = await flow.submit('A-1', '   ');
  assert.equal(result.ok, false);
  assert.equal(result.step, 'validation');
  assert.deepEqual(client.calls, []);
});

test('success posts comment then transitions', async () => {
  const client = makeClient();
  const flow = createReturnFlow({ client, primaryStatusId: '10' });
  const result = await flow.submit('A-1', 'did things');
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(client.calls, [
    ['comment', 'A-1', 'did things'],
    ['transition', 'A-1', '10'],
  ]);
});

test('comment failure skips transition and allows retry', async () => {
  const client = makeClient({ commentError: { kind: 'network', message: 'down' } });
  const flow = createReturnFlow({ client, primaryStatusId: '10' });
  const result = await flow.submit('A-1', 'text');
  assert.equal(result.ok, false);
  assert.equal(result.step, 'comment');
  assert.equal(result.message, 'down');
  assert.equal(flow.commentPosted, false);
  assert.deepEqual(client.calls.map((c) => c[0]), ['comment']);
});

test('transition failure keeps comment posted and retry does not repost', async () => {
  const client = makeClient({ transitionError: { kind: 'other', message: 'No transition' } });
  const flow = createReturnFlow({ client, primaryStatusId: '10' });
  const first = await flow.submit('A-1', 'text');
  assert.equal(first.step, 'transition');
  assert.equal(first.message, 'No transition');
  assert.equal(flow.commentPosted, true);

  client.transitionTo = async (key, id) => {
    client.calls.push(['transition', key, id]);
  };
  const second = await flow.submit('A-1', 'text');
  assert.deepEqual(second, { ok: true });
  assert.deepEqual(client.calls.map((c) => c[0]), ['comment', 'transition', 'transition']);
});

test('auth error maps to fixed message', async () => {
  const client = makeClient({ commentError: { kind: 'auth', status: 401, message: 'x' } });
  const flow = createReturnFlow({ client, primaryStatusId: '10' });
  const result = await flow.submit('A-1', 'text');
  assert.equal(result.kind, 'auth');
  assert.equal(result.message, AUTH_MESSAGE);
});
