const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createLLM } = require('../server/llm');
const { createServer } = require('../server/index');
const { listen } = require('../server/listen');
const { root } = require('../server/config');
const { schema, settings, input, output, response } = require('./round4-fixtures');
const close = server => new Promise(resolve => server.close(resolve));
function assertError(entry, code, operation) {
  assert.equal(entry.code, code);
  assert.equal(entry.operation, operation);
  assert.equal(entry.status, 'error');
  assert.ok(typeof entry.correlationId === 'string' && entry.correlationId.length);
  assert.ok(Number.isFinite(entry.durationMs) && entry.durationMs >= 0);
}

test('严格证据：仅兴趣/简介/经历不能放行；兴趣理由逐条回退；技能前四字拒绝', async () => {
  const payload = input();
  const p = payload.candidates[0];
  p.profile.interests = ['茶道'];
  p.profile.bio = '爱交流';
  p.profile.experience = '社区主持';
  p.profile.skills = ['多模态视频生成'];
  const result = output();
  for (const evidence of ['茶道', '爱交流', '社区主持', '多模态视']) {
    result.candidates[0].reason = '陈屿分享' + evidence + '，值得见面。';
    assert.equal(schema.grounded(result.candidates[0].reason, p), false);
    assert.throws(() => schema.rerank(result, [p]), /UNGROUNDED_REASON/);
  }
  result.candidates[0].reason = '陈屿对茶道有兴趣，值得见面。';
  const logs = [];
  const llm = createLLM({ config: settings, logger: e => logs.push(e), fetchImpl: async () => response(result) });
  const fixed = await llm.rerank(payload);
  assert.equal(fixed.meta.repairs[0].code, 'REASON_EVIDENCE_FALLBACK');
  assert.ok(schema.grounded(fixed.candidates[0].reason, p));
  assert.match(fixed.candidates[0].reason, /多模态视频生成/);
  assert.ok(logs.some(e => e.status === 'repair' && e.code === 'REASON_EVIDENCE_FALLBACK'));
  const noEvidence = structuredClone(p);
  noEvidence.profile = { name: '陈屿', interests: ['茶道'], bio: '爱交流', experience: '社区主持' };
  noEvidence.intent.offer = [];
  assert.throws(() => require('../server/reason-policy').repair(payload, noEvidence), /NO_SAFE_REASON/);
});

test('微信是/为/号、QQ是、vx为均脱敏，简介正文与专业内容保留', () => {
  for (const label of ['微信是', '微信为', '微信号', '微信号是', '微信号为：', 'QQ是', 'QQ号是：', 'vx 为', 'vx 是：']) {
    const id = label.startsWith('QQ') ? '123456789' : 'bonjour_01';
    const value = schema.text('做RAG知识库，' + label + id + '，欢迎交流检索方法。');
    assert.ok(!value.includes(id), label);
    assert.match(value, /做RAG知识库/);
    assert.match(value, /欢迎交流检索方法/);
    assert.match(value, /联系方式已省略/);
  }
});

test('服务端将模型与回退理由/破冰问题中的您统一为你', async () => {
  const value = output();
  value.candidates[0].reason = '陈屿擅长端侧 AI，适合与您交流。';
  value.candidates[0].icebreaker = '您如何验证端侧 AI？';
  const llm = createLLM({ config: settings, logger: () => {}, fetchImpl: async () => response(value) });
  const fixed = await llm.rerank(input());
  assert.doesNotMatch(JSON.stringify(fixed.candidates), /您/);
  assert.match(fixed.candidates[0].reason, /与你交流/);
  assert.match(fixed.candidates[0].icebreaker, /^你/);
  const invalid = output(); invalid.candidates[0].reason = '陈屿值得认识';
  const repaired = schema.rerank(invalid, input().candidates, { repair: () => ({
    reason: '陈屿擅长端侧 AI，您可以聊聊。', icebreaker: '您喜欢端侧 AI吗？'
  }) });
  assert.doesNotMatch(JSON.stringify(repaired), /您/);
  const policy = require('../src/config/reason-policy');
  assert.match(policy.fallback, /你/);
  assert.match(policy.icebreaker, /你/);
});

test('实际上游body不包含状态标记，扩展联系方式脱敏，完整公开专业信息保留', async () => {
  const payload = input();
  const p = payload.candidates[0];
  p.status = 'checked_in'; p.openToChat = false;
  p.profile.bio = '专注端侧 AI；微信是bonjour_01；QQ是123456789；vx 为demo_987';
  if (!p.visibleFields.includes('bio')) p.visibleFields.push('bio');
  let body;
  const llm = createLLM({ config: settings, logger: () => {}, fetchImpl: async (_, options) => {
    body = JSON.parse(options.body); return response();
  } });
  await llm.rerank(payload);
  const actual = JSON.parse(body.input.split('输入：')[1].trim());
  assert.doesNotMatch(JSON.stringify(actual), /status|openToChat|publicIntent|checked_in|registered|bonjour_01|123456789|demo_987/);
  assert.match(actual.candidates[0].profile.bio, /专注端侧 AI/);
  assert.equal(actual.candidates[0].profile.name, p.profile.name);
});

test('统一LLM出口记录schema/NOT_CONFIGURED/BUSY错误，每次都有完整安全结构', async () => {
  const logs = [];
  const llm = createLLM({ config: { ...settings, cacheTtl: 0 }, logger: e => logs.push(e), fetchImpl: () => new Promise(() => {}) });
  await assert.rejects(llm.rerank({ candidates: [] }, 'invalid-candidates'), /INVALID_CANDIDATES/);
  await assert.rejects(llm.intent({ text: 1 }, 'invalid-text'), /INVALID_TEXT/);
  const missing = createLLM({ config: { ...settings, key: '' }, logger: e => logs.push(e) });
  await assert.rejects(missing.rerank(input(), 'missing'), /LLM_NOT_CONFIGURED/);
  const controller = new AbortController();
  const pending = llm.rerank(input(), 'running', { signal: controller.signal });
  await assert.rejects(llm.rerank(input(), 'busy'), /LLM_BUSY/);
  controller.abort(); await assert.rejects(pending, /LLM_ABORTED/);
  for (const [id, code, operation] of [
    ['invalid-candidates', 'INVALID_CANDIDATES', 'rerank'], ['invalid-text', 'INVALID_TEXT', 'intent'],
    ['missing', 'LLM_NOT_CONFIGURED', 'rerank'], ['busy', 'LLM_BUSY', 'rerank'], ['running', 'LLM_ABORTED', 'rerank'],
  ]) {
    const entries = logs.filter(e => e.correlationId === id && e.status === 'error');
    assert.equal(entries.length, 1);
    assertError(entries[0], code, operation);
  }
  assert.doesNotMatch(JSON.stringify(logs), /TEST-SECRET|output_text|prompt|陈屿/);
});

test('HTTP错误统一记录请求号，schema错误经HTTP出口不重复记录', async t => {
  const logs = [];
  const logger = e => logs.push(e);
  const server = createServer({ config: { ...settings, root }, logger });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => close(server));
  const url = 'http://127.0.0.1:' + server.address().port;
  for (const [route, options, code, operation] of [
    ['/api/llm/rerank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"candidates":[]}' }, 'INVALID_CANDIDATES', 'rerank'],
    ['/api/llm/intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'wrong' }, 'INVALID_JSON', 'intent'],
    ['/api/llm/intent', { method: 'POST', body: '{}' }, 'JSON_REQUIRED', 'intent'],
    ['/.env.local', {}, 'NOT_FOUND', 'http'],
  ]) {
    const result = await fetch(url + route, options);
    assert.ok(result.status >= 400);
    const body = await result.json();
    const entries = logs.filter(e => e.correlationId === body.correlationId && e.status === 'error');
    assert.equal(entries.length, 1);
    assertError(entries[0], code, operation);
  }
});

test('真实HTTP连接中途断开日志为LLM_ABORTED，不依赖超时竞态', { timeout: 3000 }, async t => {
  const logs = [];
  let started, stopped;
  const ready = new Promise(resolve => started = resolve);
  const recorded = new Promise(resolve => stopped = resolve);
  const logger = e => { logs.push(e); if (e.status === 'error') stopped(); };
  const config = { ...settings, root, timeout: 1000 };
  const llm = createLLM({ config, logger, fetchImpl: async (_, options) => {
    started();
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true }));
  } });
  const server = createServer({ config, logger, llm });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => close(server));
  const controller = new AbortController();
  const pending = fetch('http://127.0.0.1:' + server.address().port + '/api/llm/rerank', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input()), signal: controller.signal });
  await ready; controller.abort();
  await assert.rejects(pending); await recorded;
  await new Promise(resolve => setImmediate(resolve));
  const errors = logs.filter(e => e.status === 'error');
  assert.equal(errors.length, 1);
  assertError(errors[0], 'LLM_ABORTED', 'rerank');
  assert.equal(logs.some(e => e.code === 'LLM_TIMEOUT'), false);
});

test('缓存键采用显式版本，配置模块增加函数或循环引用不影响精排或命中', async () => {
  const modules = ['matching', 'synonyms', 'reasons', 'reason-policy'].map(name => require('../src/config/' + name));
  let calls = 0;
  const llm = createLLM({ config: settings, logger: () => {}, fetchImpl: async () => { calls++; return response(); } });
  try {
    for (const config of modules) { config.testFunction = () => 'unused'; config.testCycle = config; }
    assert.equal((await llm.rerank(input())).meta.cache, 'miss');
    assert.equal((await llm.rerank(input())).meta.cache, 'hit');
    assert.equal(calls, 1);
    const versions = require('../server/cache-versions');
    assert.ok(Object.values(versions).every(value => typeof value === 'string'));
    assert.equal(Object.isFrozen(versions), true);
  } finally {
    for (const config of modules) { delete config.testFunction; delete config.testCycle; }
  }
});

test('listen失败打印具名错误、底层安全原因和统一日志字段', async () => {
  const logs = [];
  const server = new EventEmitter();
  server.listen = () => queueMicrotask(() => server.emit('error', Object.assign(Error('SECRET raw message'), { code: 'EACCES' })));
  await assert.rejects(listen(server, { port: 8787 }, { logger: e => logs.push(e) }), /LISTEN_FAILED/);
  assert.equal(logs.length, 1);
  assertError(logs[0], 'LISTEN_FAILED', 'listen');
  assert.equal(logs[0].causeCode, 'EACCES');
  assert.doesNotMatch(JSON.stringify(logs), /SECRET|raw message/);
});
