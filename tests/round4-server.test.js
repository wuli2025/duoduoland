const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createLLM } = require('../server/llm');
const { createServer } = require('../server/index');
const { listen } = require('../server/listen');
const { createCache } = require('../server/cache');
const { root } = require('../server/config');
const { schema, engine, settings, input, output, response, me, candidate, rows } = require('./round4-fixtures');
const close = server => new Promise(resolve => server.close(resolve));

test('理由完整证据、姓名、合作条件及措辞检查；内部措辞仅该条回退并记录', async () => {
  const p = input().candidates[0];
  p.profile.cooperation = ['联合创始人'];
  assert.ok(schema.grounded('陈屿希望以联合创始人的身份合作。', p));
  assert.equal(schema.grounded('擅长端侧 AI', p), false);
  assert.equal(schema.grounded('陈屿分享了任意经历片段', { ...p, profile: { name: '陈屿', bio: '任意经历片段后还有关键限定' }, intent: { offer: [] } }), false);
  const value = output();
  value.candidates[0].reason = '陈屿擅长端侧 AI，但反向需求未披露';
  assert.throws(() => schema.rerank(value, [p]), /INVALID_REASON_WORDING/);
  const logs = [];
  const llm = createLLM({ config: settings, logger: e => logs.push(e), fetchImpl: async () => response(value) });
  const result = await llm.rerank(input());
  assert.ok(schema.wording(result.candidates[0].reason));
  assert.ok(schema.grounded(result.candidates[0].reason, p));
  assert.equal(result.candidates[0].score, value.candidates[0].score);
  assert.deepEqual(result.meta.repairs, [{ id: p.id, code: 'REASON_WORDING_FALLBACK' }]);
  assert.ok(logs.some(e => e.code === 'REASON_WORDING_FALLBACK'));
  assert.doesNotMatch(JSON.stringify(logs), /反向需求|SECRET|prompt/);
});

test('内部状态不伪造默认值、不进入提示词；微信QQ按明确标记脱敏', () => {
  const p = input().candidates[0];
  delete p.status;
  delete p.openToChat;
  const clean = schema.projection(p);
  assert.equal('status' in clean, false);
  assert.equal('openToChat' in clean, false);
  const prompt = require('../server/prompt-input').compact(input());
  assert.doesNotMatch(JSON.stringify(prompt), /status|openToChat|publicIntent|visibleFields/);
  const text = schema.text('开发知识库，微信: alice_123；QQ号：1234567；邮箱 user@example.com，欢迎讨论。');
  assert.doesNotMatch(text, /alice_123|1234567|user@example/);
  assert.match(text, /开发知识库/);
});

test('拒绝failed/cancelled/queued上游状态；HTTP日志包含状态码且不含原文', async () => {
  for (const status of ['failed', 'cancelled', 'queued']) {
    const llm = createLLM({ config: settings, logger: () => {}, fetchImpl: async () => response(output(), status) });
    await assert.rejects(llm.rerank(input()), /LLM_UPSTREAM_STATUS/);
  }
  const logs = [];
  const failed = createLLM({ config: settings, logger: e => logs.push(e), fetchImpl: async () => ({
    ok: false, status: 401, json: async () => ({ error: { message: 'SECRET raw prompt' } }) }) });
  await assert.rejects(failed.rerank(input()), /LLM_UPSTREAM_HTTP/);
  assert.ok(logs.some(e => e.httpStatus === 401));
  assert.doesNotMatch(JSON.stringify(logs), /SECRET|prompt/);
  const missing = createLLM({ config: { ...settings, key: '' }, logger: e => logs.push(e) });
  await assert.rejects(missing.rerank(input()), /LLM_NOT_CONFIGURED/);
  assert.ok(logs.some(e => e.code === 'LLM_NOT_CONFIGURED'));
});

test('UTF-8汉字跨Buffer分块保持原值，请求体按字节限制', async t => {
  let received;
  const server = createServer({ config: { ...settings, root }, llm: { intent: async body => { received = body.text; return {}; } } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => close(server));
  const bytes = Buffer.from(JSON.stringify({ text: '找端侧推理工程师' }));
  const split = bytes.indexOf(Buffer.from('端')) + 1;
  const result = await new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: server.address().port,
      path: '/api/llm/intent', method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
      res.resume(); res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.write(bytes.subarray(0, split));
    setTimeout(() => req.end(bytes.subarray(split)), 5);
  });
  assert.equal(result, 200);
  assert.equal(received, '找端侧推理工程师');
  const tooLarge = await fetch('http://127.0.0.1:' + server.address().port + '/api/llm/intent', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '汉'.repeat(40000) }) });
  assert.equal(tooLarge.status, 413);
});

test('端口占用自动顺延、打印并打开实际URL；上限耗尽具名退出', async t => {
  const occupied = http.createServer();
  await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
  t.after(() => close(occupied));
  const port = occupied.address().port;
  const logs = [], urls = [];
  const server = http.createServer();
  const actual = await listen(server, { port, portAttempts: 5 }, { logger: e => logs.push(e), open: true, openBrowser: url => urls.push(url) });
  t.after(() => close(server));
  assert.ok(server.address().port > port);
  assert.deepEqual(urls, [actual.url]);
  assert.ok(logs.some(e => e.code === 'PORT_IN_USE' && e.port === port));
  assert.ok(logs.some(e => e.url === actual.url));
  await assert.rejects(listen(http.createServer(), { port, portAttempts: 1 }, { logger: e => logs.push(e) }), /PORT_RANGE_EXHAUSTED/);
});

test('缓存包含候选集合、本地分/新鲜度、状态、意图、模型与提示词', async () => {
  let calls = 0;
  const cfg = { ...settings };
  const llm = createLLM({ config: cfg, logger: () => {}, fetchImpl: async () => { calls++; return response(); } });
  assert.equal((await llm.rerank(input())).meta.cache, 'miss');
  assert.equal((await llm.rerank(input())).meta.cache, 'hit');
  for (const action of ['greeted', 'met']) {
    const score = engine.score(me, candidate, { [action]: [candidate.id] });
    const changed = input();
    changed.local = [{ id: score.id, score: score.score, fresh: score.factors.fresh, ...score.interaction }];
    assert.equal((await llm.rerank(changed)).meta.cache, 'miss');
  }
  const status = input(); status.candidates[0].status = 'registered';
  assert.equal((await llm.rerank(status)).meta.cache, 'miss');
  cfg.model = 'another-model';
  assert.equal((await llm.rerank(input())).meta.cache, 'miss');
  assert.equal(calls, 5);
  // Cache identity itself is content-addressed, including prompt and collection.
  const cache = createCache(); let versions = 0;
  const work = async () => ++versions;
  await cache.getOrRun({ prompt: 'v1', candidates: ['a'] }, work);
  assert.equal((await cache.getOrRun({ prompt: 'v2', candidates: ['a'] }, work)).cache, 'miss');
  assert.equal((await cache.getOrRun({ prompt: 'v2', candidates: ['b'] }, work)).cache, 'miss');
});

test('取消旧请求会中止上游并释放槽；共享请求尚有订阅者时不误取消', async () => {
  let started, observed, calls = 0;
  const ready = new Promise(resolve => started = resolve);
  const llm = createLLM({ config: settings, logger: () => {}, fetchImpl: async (_, options) => {
    if (++calls > 1) return response();
    observed = options.signal; started();
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(Error('aborted')), { once: true }));
  } });
  const controller = new AbortController();
  const first = llm.rerank(input(), 'old', { signal: controller.signal });
  await ready;
  controller.abort();
  await assert.rejects(first, /LLM_ABORTED/);
  assert.equal(observed.aborted, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await llm.rerank(input())).meta.cache, 'miss');
  const cache = createCache(); let release, sharedSignal;
  const work = signal => { sharedSignal = signal; return new Promise(resolve => release = resolve); };
  const a = new AbortController();
  const one = cache.getOrRun('same', work, a.signal);
  const two = cache.getOrRun('same', work);
  a.abort(); await assert.rejects(one, /LLM_ABORTED/);
  assert.equal(sharedSignal.aborted, false);
  release('done');
  assert.equal((await two).result, 'done');
});

test('HTTP客户端断开会传递取消信号给LLM', async t => {
  let started, aborted;
  const ready = new Promise(resolve => started = resolve);
  const cancelled = new Promise(resolve => aborted = resolve);
  const server = createServer({ config: { ...settings, root }, llm: { rerank: (_, id, { signal }) => {
    started();
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => {
      aborted(); reject(Object.assign(Error('LLM_ABORTED'), { code: 'LLM_ABORTED' }));
    }));
  } } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => close(server));
  const controller = new AbortController();
  const pending = fetch('http://127.0.0.1:' + server.address().port + '/api/llm/rerank', {
    method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: '{}' });
  await ready; controller.abort();
  await assert.rejects(pending);
  await cancelled;
});
