const test = require('node:test');
const assert = require('node:assert/strict');
const schema = require('../src/core/llm-schema');
const client = require('../src/core/llm-client');
const dating = require('../src/core/dating');
const { repair } = require('../server/reason-policy');
const { createLLM } = require('../server/llm');
const demo = require('../scripts/load-demo')();
const scenario = require('../scripts/eval-dating-scenarios').scenarios(demo)[0];
const { engine, config, data } = demo;
const members = data.people.filter(p => p.sessions[scenario.eventId]).map(p => ({ ...p, session: p.sessions[scenario.eventId] }));
const rows = engine.rank(scenario.me, members);
const input = () => ({ eventId: scenario.eventId, me: engine.project(scenario.me), intent: scenario.me.session.intent,
  candidates: rows.map(r => structuredClone(r.public)) });
const output = () => ({ candidates: rows.map(r => ({ id: r.id, score: r.score, needAB: 1, needBA: 1,
  complement: .8, common: .8, reason: r.reason, icebreaker: r.icebreaker, fitReason: r.fitReason })) });
const cfg = { key: 'test-private', model: 'test', baseUrl: 'https://invalid.example', timeout: 100, concurrency: 1, cacheTtl: 1000 };
const response = value => ({ ok: true, json: async () => ({ output_text: JSON.stringify(value) }) });

test('交友输出fitReason长度、双方公开证据与禁用词检查，失败仅回退该候选并留痕', async () => {
  for (const invalid of [undefined, '林澈漂亮，和你一起户外一定合适。', '林澈和你都喜欢未公开的潜水。',
    '林澈和你都喜欢户外。'.repeat(9), '林澈和你都喜欢户外，收入很高。', '林澈和你都喜欢户外，微信是ab123456。']) {
    const payload = input(), result = output(); result.candidates[0].fitReason = invalid;
    const logs = [];
    const server = createLLM({ config: cfg, logger: row => logs.push(row), fetchImpl: async () => response(result) });
    const out = await server.rerank(payload, 'fit-test');
    assert.equal(out.candidates.length, 2);
    assert.deepEqual(out.meta.repairs, [{ id: rows[0].id, code: 'FIT_REASON_FALLBACK' }]);
    assert.ok(logs.some(log => log.status === 'repair' && log.candidateId === rows[0].id));
    for (const r of out.candidates) {
      const candidate = payload.candidates.find(p => p.id === r.id);
      assert.ok([...r.fitReason].length <= 60 && dating.safe(r.fitReason) && dating.grounded(r.fitReason, payload.me, candidate));
    }
    assert.equal(out.candidates[1].fitReason, result.candidates[1].fitReason);
  }
});
test('客户端实际body与服务端上游仅含公开交友字段，隐藏联系方式/教育/意图不能泄露', async () => {
  const original = structuredClone(members.find(p => p.id === rows[0].id));
  original.profile.education = 'PRIVATE-EDUCATION'; original.profile.contact = 'PRIVATE-CONTACT';
  original.profile.secret = 'PRIVATE-EXTRA'; original.profile.bio = 'PRIVATE-BASE-BIO';
  original.session.publicIntent = false; original.session.intent.offer = ['PRIVATE-INTENT'];
  original.profile.datingPreference.secret = 'PRIVATE-PREFERENCE';
  const originalMe = structuredClone(scenario.me); originalMe.profile.contact = 'PRIVATE-ME-CONTACT';
  originalMe.session.intent.hidden = 'PRIVATE-QUERY';
  const local = engine.rank(originalMe, [original]);
  // Pass an actual full raw record to the client path, rather than a precleaned fixture.
  local[0].public = original;
  let browserBody, upstreamBody;
  const server = createLLM({ config: cfg, logger: () => {}, fetchImpl: async (_, options) => {
    upstreamBody = options.body;
    const p = engine.project(original);
    return response({ candidates: [{ id: original.id, score: 86, needAB: 1, needBA: 1, complement: .5, common: .8,
      ...dating.reasons(engine.project(originalMe), p) }] });
  } });
  const api = client.create(config.llm, engine, { fetchImpl: async (url, options) => {
    if (url.endsWith('health')) return { ok: true, json: async () => ({ ok: true, model: 'test', timeoutMs: 100, appVersion: config.llm.appVersion }) };
    browserBody = options.body;
    const value = JSON.parse(browserBody);
    value.candidates[0].profile.education = 'PRIVATE-ADDED-AT-SERVER';
    value.candidates[0].profile.datingPreference.secret = 'PRIVATE-ADDED-NESTED';
    return { ok: true, json: async () => server.rerank(value) };
  } });
  const result = await api.rerank(originalMe, originalMe.session.intent, local);
  assert.equal(result.engine, 'llm');
  assert.doesNotMatch(browserBody, /PRIVATE-|contact|education|versions|sessions/);
  assert.doesNotMatch(upstreamBody, /PRIVATE-|openToChat|"status"|publicIntent|visibleFields|cardType/);
  const sent = JSON.parse(browserBody);
  assert.deepEqual(Object.keys(sent.candidates[0].profile.datingPreference).sort(), ['ageRange','genders','priorities']);
  assert.ok(result.rows.every(r => r.fitReason));
});
test('恋爱接口拒绝不合格候选；非dating输出禁止携带fitReason', () => {
  const bad = input(); bad.candidates[0].profile.relationshipStatus = '已婚';
  assert.throws(() => schema.request(bad), /DATING_NOT_ELIGIBLE/);
  assert.throws(() => schema.rerank(output(), input().candidates), /INVALID_LLM_SCHEMA/);
  const valid = input();
  const checked = schema.rerank(output(), valid.candidates, { mode: 'dating', me: valid.me });
  assert.equal(checked.length, 2);
  assert.ok(checked.every(r => r.fitReason));
});
test('file与服务失败降级保留合格人数、fitReason及真实本地引擎', async () => {
  for (const protocol of ['file:', 'http:']) {
    let calls = 0;
    const api = client.create({ ...config.llm, timeout: 5 }, engine, { protocol, fetchImpl: async () => { calls++; throw Error('offline'); } });
    const out = await api.rerank(scenario.me, scenario.me.session.intent, rows);
    assert.equal(out.engine, 'local'); assert.equal(out.rows.length, 2);
    assert.ok(out.rows.every(r => dating.safe(r.fitReason) && [...r.fitReason].length <= 60));
    if (protocol === 'file:') assert.equal(calls, 0);
  }
});
test('LLM intent支持交友字段与相对年龄，客户端只发送必要的ownAge', async () => {
  let body;
  const server = createLLM({ config: cfg, logger: () => {}, fetchImpl: async (_, options) => {
    body = options.body;
    return response(engine.parseIntent('找男朋友，年龄相仿', data.me.profile));
  } });
  const result = await server.intent({ text: '找男朋友，年龄相仿', ownAge: 30, contact: 'PRIVATE' });
  assert.equal(result.mode, 'dating'); assert.deepEqual(result.ageRange, [25,35]);
  assert.doesNotMatch(body, /PRIVATE/); assert.match(body, /ownAge/);
  assert.throws(() => schema.intent({ ...result, ageRange: [15,35] }), /INVALID_DATING_INTENT/);
});
