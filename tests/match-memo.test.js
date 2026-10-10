const test = require('node:test');
const assert = require('node:assert/strict');
const progressive = require('../src/core/progressive.js');

test('restore 显示已完成的精排结果，不进入请求状态', () => {
  const first = progressive.create();
  const token = first.begin([]);
  first.recall(token, [{ id: 'a' }], [{ id: 'a', score: 70 }]);
  first.request(token, { model: 'm', startedAt: 0 });
  first.settle(token, { engine: 'llm', rows: [{ id: 'a', score: 88 }], meta: { model: 'm' } });
  const snapshot = first.get();

  const revisit = progressive.create();
  revisit.restore(snapshot);
  const state = revisit.get();
  assert.equal(state.phase, 'done');
  assert.equal(state.pending, false);
  assert.deepEqual(state.rows, [{ id: 'a', score: 88 }]);
  assert.equal(state.meta.model, 'm');
});

test('restore 之后旧请求的 settle 会被忽略', () => {
  const p = progressive.create();
  const stale = p.begin([]);
  p.restore({ phase: 'cached', rows: [{ id: 'b', score: 80 }], meta: {} });
  assert.equal(p.settle(stale, { engine: 'llm', rows: [{ id: 'x', score: 1 }] }), false);
  assert.equal(p.get().rows[0].id, 'b');
});
