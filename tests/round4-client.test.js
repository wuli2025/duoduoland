const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const client = require('../src/core/llm-client');
const { createLLM } = require('../server/llm');
const { engine, config, schema, me, candidate, rows, settings, input, output, response, data } = require('./round4-fixtures');
const health = { ok: true, json: async () => ({ ok: true, timeoutMs: 1 }) };

test('project只接受投影形状，缺版本得到空profile，声明外字段不会短路泄露', () => {
  const raw = { id: 'p', profile: { name: '姓名', contact: 'SECRET' }, intent: me.session.intent };
  assert.deepEqual(engine.project(raw).profile, {});
  const declared = { ...raw, visibleFields: ['name'], status: 'checked_in', openToChat: true };
  assert.deepEqual(engine.project(declared).profile, { name: '姓名' });
  assert.deepEqual(engine.project({ ...declared, privateRecords: 'SECRET' }).profile, {});
  assert.deepEqual(engine.project({ public: declared }).profile, { name: '姓名' });
});

test('客户端实际fetch body从原始档案过滤隐私；服务端实际上游再次过滤', async () => {
  const original = structuredClone(candidate);
  const version = original.versions.find(v => v.id === original.session.versionId);
  version.visibleFields = ['name', 'title', 'industry', 'skills', 'bio', 'contact'];
  original.profile.education = 'HIDDEN-SCHOOL';
  original.profile.contact = 'CONTACT-SECRET';
  original.profile.secret = 'HIDDEN-FIELD';
  original.profile.bio = '开发产品，微信: wx_secret99，QQ: 123456789';
  original.session.publicIntent = false;
  original.session.intent.offer = ['HIDDEN-INTENT'];
  const own = structuredClone(me);
  own.profile.secret = 'OWN-HIDDEN';
  let body, upstream;
  const llm = client.create(config.llm, engine, { fetchImpl: async (url, options) => {
    if (url.endsWith('/health')) return health;
    body = JSON.parse(options.body);
    return { ok: true, json: async () => output() };
  } });
  const result = await llm.rerank(own, { ...me.session.intent, internalNote: 'PRIVATE-QUERY', contact: 'OWN-CONTACT' },
    [{ ...rows[0], public: original }]);
  assert.equal(result.engine, 'llm');
  assert.doesNotMatch(JSON.stringify(body), /HIDDEN|CONTACT|PRIVATE-QUERY|wx_secret99|123456789|versions|sessions|internalNote/);
  assert.deepEqual(body.candidates[0].intent.offer, []);
  assert.deepEqual(Object.keys(body).sort(), ['candidates', 'eventId', 'intent', 'local', 'me']);
  assert.deepEqual(Object.keys(body.local[0]).sort(), ['fresh', 'greeted', 'id', 'met', 'score']);
  assert.deepEqual(Object.keys(body.intent).sort(), Object.keys(schema.intent(me.session.intent)).sort());
  const service = createLLM({ config: settings, logger: () => {}, fetchImpl: async (_, options) => {
    upstream = JSON.parse(options.body).input;
    return response();
  } });
  const payload = input();
  payload.candidates = [original];
  payload.me = own;
  payload.intent.internalNote = 'PRIVATE-QUERY';
  await service.rerank(payload);
  const sent = JSON.parse(upstream.split('输入：')[1].trim());
  assert.doesNotMatch(JSON.stringify(sent), /HIDDEN|CONTACT|PRIVATE-QUERY|wx_secret99|123456789|status|openToChat|publicIntent|visibleFields|versions/);
  assert.deepEqual(Object.keys(sent.candidates[0]).sort(), ['id', 'intent', 'profile']);
});

test('file和关闭LLM完全不fetch；offline状态拒绝模型结果且保留原行', async () => {
  for (const [protocol, enabled] of [['file:', true], ['http:', false]]) {
    let count = 0;
    const llm = client.create({ ...config.llm, enabled }, engine, { protocol, fetchImpl: () => { count++; throw Error(); } });
    assert.equal((await llm.rerank(engine.project(me), me.session.intent, rows)).error, 'LLM_OFFLINE');
    assert.equal((await llm.parseIntent('找技术合伙人')).engine, 'local');
    assert.equal(count, 0);
  }
  const state = require('../src/core/progressive').create();
  const token = state.begin(rows, { offline: true });
  assert.equal(state.settle(token, { engine: 'llm', rows: [] }), false);
  assert.equal(state.get().phase, 'local');
  assert.equal(state.get().rows, rows);
});

test('超时/HTTP具名错误/非法JSON进入failed并保留本地行，没有未处理reject', async () => {
  const cases = [
    ['LLM_TIMEOUT', () => new Promise(() => {})],
    ['LLM_BUSY', async () => ({ ok: false, json: async () => ({ error: 'LLM_BUSY' }) })],
    ['LLM_INVALID_JSON', async () => ({ ok: true, json: async () => { throw Error('raw'); } })],
    ['LLM_NETWORK', async () => { throw Error('network'); }],
    ['INVALID_LLM_SCHEMA', async () => ({ ok: true, json: async () => ({ candidates: [] }) })],
  ];
  for (const [code, fake] of cases) {
    const llm = client.create({ ...config.llm, timeout: 10 }, engine, {
      fetchImpl: (url, options) => url.endsWith('/health') ? Promise.resolve({ ok: false, json: async () => ({}) }) : fake(options) });
    const result = await llm.rerank(engine.project(me), me.session.intent, rows);
    assert.equal(result.error, code);
    const state = require('../src/core/progressive').create();
    state.settle(state.begin(rows), result);
    assert.equal(state.get().phase, 'failed');
    assert.equal(state.get().rows, rows);
    assert.equal(state.get().error, code);
  }
});

test('意图成功/降级返回真实引擎，health失败下次重新协商，外部取消传播给fetch', async () => {
  let healthCalls = 0, transportSignal, started;
  const waitForStart = new Promise(resolve => started = resolve);
  const llm = client.create({ ...config.llm, timeout: 30 }, engine, { fetchImpl: async (url, options) => {
    if (url.endsWith('/health')) { healthCalls++; return { ok: false, json: async () => ({}) }; }
    if (url.endsWith('/intent')) return { ok: true, json: async () => schema.intent(me.session.intent) };
    transportSignal = options.signal;
    started();
    return new Promise(() => {});
  } });
  assert.equal((await llm.parseIntent('找工程师')).engine, 'llm');
  const controller = new AbortController();
  const pending = llm.rerank(engine.project(me), me.session.intent, rows, 5, '', { signal: controller.signal });
  await waitForStart;
  controller.abort();
  assert.equal((await pending).error, 'LLM_ABORTED');
  assert.equal(transportSignal.aborted, true);
  assert.equal(healthCalls, 2);
});

test('MMR选人后按最终分数稳定降序，包括融合、技术切换和同分', () => {
  const people = data.people.filter(p => p.sessions['ai-agent-night']).map(p => ({ ...p, session: p.sessions['ai-agent-night'] }));
  const ranked = engine.rank(me, people, { limit: 10 });
  assert.ok(ranked.every((r, i) => !i || ranked[i - 1].score >= r.score));
  const tied = rows.concat([{ ...rows[0], id: 'other' }]);
  assert.deepEqual(engine.mmr(tied, 2).map(r => r.id), tied.map(r => r.id));
  const remote = output().candidates;
  const fused = client.fuse(rows, remote, config.llm, engine);
  assert.ok(fused.every((r, i) => !i || fused[i - 1].score >= r.score));
});

test('18位AI人物兴趣和教育独立撰写，p49–p66文件均真实存在且唯一', () => {
  const people = data.people.slice(60);
  assert.equal(new Set(people.map(p => p.profile.education)).size, 18);
  assert.equal(new Set(people.map(p => p.profile.interests.join(','))).size, 18);
  assert.equal(new Set(people.map(p => p.profile.avatar)).size, 18);
  people.forEach(p => assert.ok(fs.statSync(path.join(__dirname, '../assets/img/avatars', p.profile.avatar + '.jpg')).size > 1000));
});
