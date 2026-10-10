const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createLLM } = require('../server/llm');
const { createCache } = require('../server/cache');
const client = require('../src/core/llm-client');
const progressive = require('../src/core/progressive');
const { config, engine, rows, settings, input, output, response } = require('./round4-fixtures');

test('真实状态idle→reading→recalled→llm-pending→done/cached，等待不展示排名、请求起点决定时钟', () => {
  let now = 0;
  const state = progressive.create({ now: () => now });
  assert.equal(state.get().phase, 'idle');
  assert.equal(state.elapsed(), 0);
  const token = state.begin(rows);
  assert.equal(state.get().phase, 'reading');
  assert.deepEqual(state.get().rows, []);
  state.read(token, 41);
  state.recall(token, rows, rows);
  assert.equal(state.get().readCount, 41);
  assert.equal(state.get().phase, 'recalled');
  now = 99999;
  assert.equal(state.elapsed(), 0);
  assert.equal(state.get().phase, 'recalled');
  state.request(token, { model: 'real-model', startedAt: now });
  assert.equal(state.get().phase, 'llm-pending');
  now += 2345;
  assert.equal(state.elapsed(), 2345);
  assert.deepEqual(state.get().rows, []);
  state.settle(token, { engine: 'llm', rows, meta: { cached: false } });
  assert.equal(state.get().phase, 'done');
  now += 5000;
  assert.equal(state.elapsed(), 2345);
  assert.equal(state.settle(token, { engine: 'llm', rows: [] }), false);
  const next = state.begin(rows);
  state.recall(next, rows, rows);
  state.request(next);
  state.settle(next, { engine: 'llm', rows, meta: { cached: true } });
  assert.equal(state.get().phase, 'cached');
});

test('失败才显示本地排名，离线不进入思考、过期请求不能推进新状态', () => {
  const state = progressive.create();
  const old = state.begin(rows), current = state.begin(rows);
  assert.equal(state.read(old, 999), false);
  assert.equal(state.recall(old, [], []), false);
  assert.equal(state.request(old), false);
  state.recall(current, rows, rows);
  state.request(current);
  state.settle(current, { engine: 'local', error: 'LLM_TIMEOUT' });
  assert.equal(state.get().phase, 'failed');
  assert.equal(state.get().rows, rows);
  const local = state.begin(rows, { offline: true });
  assert.equal(state.get().phase, 'local');
  assert.equal(state.get().rows, rows);
  assert.equal(state.request(local), false);
  assert.equal(state.settle(local, { engine: 'llm', rows: [] }), false);
});

test('服务端meta来自真实配置/请求且命中时间不变；bypass绕过缓存并更新原缓存', async () => {
  let calls = 0, sent;
  const logs = [];
  const llm = createLLM({ config: settings, logger: e => logs.push(e), fetchImpl: async (_, options) => {
    calls++; sent = JSON.parse(options.body); return response();
  } });
  const first = await llm.rerank(input(), 'first');
  const hit = await llm.rerank(input(), 'hit');
  assert.equal(calls, 1);
  assert.equal(first.meta.cached, false);
  assert.equal(hit.meta.cached, true);
  assert.equal(hit.meta.cachedAt, first.meta.cachedAt);
  assert.equal(hit.meta.model, settings.model);
  assert.equal(hit.meta.correlationId, 'hit');
  assert.equal(hit.meta.sourceCorrelationId, 'first');
  assert.ok(Number.isFinite(hit.meta.durationMs));
  const fresh = await llm.rerank({ ...input(), bypassCache: true }, 'bypassed');
  assert.equal(calls, 2);
  assert.equal(fresh.meta.cached, false);
  assert.equal(fresh.meta.correlationId, 'bypassed');
  assert.doesNotMatch(JSON.stringify(sent), /bypassCache/);
  const next = await llm.rerank(input(), 'next');
  assert.equal(next.meta.sourceCorrelationId, 'bypassed');
  assert.equal(next.meta.cached, true);
  assert.equal(calls, 2);
  assert.equal(logs.filter(e => e.operation === 'rerank' && e.status === 'ok').length, 2);
  assert.doesNotMatch(JSON.stringify(first.meta), /TEST-SECRET|prompt|input/);
  await assert.rejects(llm.rerank({ ...input(), bypassCache: 'true' }), /INVALID_BYPASS_CACHE/);
});

test('bypass不会复用正在等待的旧请求，旧请求迟到也不能覆盖新缓存', async () => {
  const cache = createCache();
  let resolveOld, calls = 0;
  const old = cache.getOrRun('same', () => { calls++; return new Promise(resolve => resolveOld = resolve); });
  const newer = await cache.getOrRun('same', async () => { calls++; return 'new'; }, undefined, { bypass: true });
  assert.equal(newer.cache, 'miss');
  assert.equal(calls, 2);
  resolveOld('old');
  await old;
  const hit = await cache.getOrRun('same', () => assert.fail('unexpected upstream'));
  assert.equal(hit.result, 'new');
});

test('客户端onRequest紧邻真实fetch且不含health等待；meta白名单透传、bypass出现在POST body', async () => {
  let releaseHealth, fetchStarted = false, requestInfo, body;
  const meta = { ...output().meta, model: 'configured-model', secret: 'UNEXPECTED-SECRET' };
  const llm = client.create(config.llm, engine, { fetchImpl: async (url, options) => {
    if (url.endsWith('/health')) return new Promise(resolve => releaseHealth = () => resolve({ ok: true,
      json: async () => ({ ok: true, model: meta.model, timeoutMs: 60000 }) }));
    fetchStarted = true;
    assert.ok(requestInfo && Math.abs(Date.now() - requestInfo.startedAt) < 100);
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ ...output(), meta }) };
  } });
  const result = llm.rerank(input().me, input().intent, rows, 5, 'ai-agent-night', {
    bypassCache: true, onRequest: info => { assert.equal(fetchStarted, false); requestInfo = info; }
  });
  assert.equal(requestInfo, undefined);
  releaseHealth();
  const value = await result;
  assert.equal(requestInfo.model, meta.model);
  assert.equal(body.bypassCache, true);
  assert.equal(value.engine, 'llm');
  assert.equal(value.meta.model, meta.model);
  assert.equal(value.meta.correlationId, meta.correlationId);
  assert.equal(value.meta.secret, undefined);
});

test('缺少或非法meta不能冒称真实精排', async () => {
  for (const meta of [undefined, { ...output().meta, durationMs: -1 }, { ...output().meta, cachedAt: 'invalid' }]) {
    const llm = client.create(config.llm, engine, { fetchImpl: async () => ({ ok: true, json: async () => ({ ...output(), meta }) }) });
    const result = await llm.rerank(input().me, input().intent, rows);
    assert.equal(result.engine, 'local');
    assert.equal(result.error, 'INVALID_LLM_META');
  }
});

test('计算人数来自实际过滤后评分池，非活动宣传人数；候选数为真实召回数', () => {
  const demo = require('../scripts/load-demo')();
  const people = demo.data.people.filter(p => p.sessions['ai-agent-night']).map(p => ({ ...p, session: p.sessions['ai-agent-night'] }));
  const excluded = [people[0].id];
  let count;
  const actual = engine.rank(input().me, people, { checkedOnly: true, exclude: excluded, limit: 10,
    onRead: value => count = value });
  assert.equal(count, people.filter(p => p.id !== input().me.id && !excluded.includes(p.id) && p.session.status === 'checked_in').length);
  assert.equal(actual.length, 10);
});

test('活动名单签到优先，仅公开投影；头像/职位隐藏后不泄露，墙和卡片数量配置生效', () => {
  const demo = require('../scripts/load-demo')({ localStorage: { getItem: () => null, setItem: () => {} } });
  const store = demo.createStore(demo.config, demo.data);
  const service = demo.createService(demo.config, demo.data, store, demo.engine);
  const first = demo.data.people.find(p => p.sessions['ai-agent-night']);
  const version = first.versions.find(v => v.id === first.sessions['ai-agent-night'].versionId);
  version.visibleFields = ['name'];
  first.profile.avatar = 'PRIVATE-PHOTO'; first.profile.title = 'PRIVATE-TITLE';
  const attendance = service.attendance('ai-agent-night');
  const projected = attendance.people.find(p => p.id === first.id);
  assert.deepEqual(Object.keys(projected.profile), ['name']);
  assert.equal(projected.sessions, undefined);
  assert.ok(attendance.people.every((p, i, a) => !i || p.status !== 'checked_in' || a[i - 1].status === 'checked_in'));
  assert.equal(attendance.checked, attendance.people.filter(p => p.status === 'checked_in').length);
  const context = { window: { BJ: {} } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../src/ui/attendees'), 'utf8'), context);
  const ui = { e: String, avatar: p => JSON.stringify(p) };
  const ctx = { service, config: demo.config, ui };
  const wall = context.window.BJ.attendees(ctx, 'ai-agent-night', { wall: true });
  assert.equal((wall.avatars.match(/data-open-person=/g) || []).length, 24);
  assert.doesNotMatch(wall.avatars, /PRIVATE-PHOTO|PRIVATE-TITLE/);
  assert.match(wall.note, /已公开名片/);
  const card = context.window.BJ.attendees(ctx, 'ai-agent-night');
  assert.equal((card.avatars.match(/class="attendee-mini"/g) || []).length, 4);
});
