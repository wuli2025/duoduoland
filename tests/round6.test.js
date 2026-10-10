const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createLLM } = require('../server/llm');
const { repair } = require('../server/reason-policy');
const client = require('../src/core/llm-client');
const { schema, settings, input, output, response, engine, data, config } = require('./round4-fixtures');
const count = text => [...text].length;
function person(id, name, skill, extra = {}) {
  const profile = { ...(name ? { name } : {}), skills: [skill], ...extra };
  return { id, profile, visibleFields: Object.keys(profile), intent: {
    seekRoles: [], seekIndustries: [], offer: [], city: ''
  }, status: 'checked_in', openToChat: true };
}
const invalid = p => ({ ...output().candidates[0], id: p.id, reason: '值得认识。', icebreaker: '聊聊吗？' });

test('回退预算：10字姓名、16/17/25字完整技能及9–16字话题均生成完整问句', async () => {
  for (const size of [...Array.from({ length: 8 }, (_, i) => i + 9), 17, 25]) {
    const p = person('long-topic', '甲乙丙丁戊己庚辛壬癸', '技'.repeat(size));
    const payload = { ...input(), candidates: [p], local: [] };
    const llm = createLLM({ config: settings, logger: () => {}, fetchImpl: async () => response({ candidates: [invalid(p)] }) });
    const result = await llm.rerank(payload);
    assert.equal(result.candidates.length, 1, String(size));
    const row = result.candidates[0];
    assert.ok(count(row.reason) <= 40 && schema.grounded(row.reason, p));
    assert.ok(count(row.icebreaker) <= 20);
    assert.match(row.icebreaker, /[？?]$/);
    assert.equal(result.meta.repairs.length, 1);
    assert.equal(result.dropped.length, 0);
  }
});

test('41字唯一证据只移除该候选、记录candidateId；部分结果仍正常融合且校验缺项', async () => {
  const payload = input();
  const bad = person('too-long', '长技能', '技'.repeat(41));
  payload.candidates.push(bad);
  const logs = [];
  const llm = createLLM({ config: settings, logger: e => logs.push(e), fetchImpl: async () =>
    response({ candidates: [...output().candidates, invalid(bad)] }) });
  const result = await llm.rerank(payload);
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.dropped, [bad.id]);
  assert.ok(logs.some(e => e.status === 'drop' && e.candidateId === bad.id && e.code === 'NO_SAFE_REASON'));
  const local = payload.candidates.map(p => engine.score(payload.me, p));
  assert.equal(client.fuse(local, result.candidates, config.llm, engine, 5, result.dropped).length, 1);
  assert.throws(() => client.fuse(local, result.candidates, config.llm, engine), /INVALID_LLM_SCHEMA/);
  assert.throws(() => client.fuse(local, result.candidates, config.llm, engine, 5, ['stranger']), /INVALID_DROPPED_IDS/);
  assert.throws(() => schema.rerank({ candidates: result.candidates }, payload.candidates,
    { dropped: [result.candidates[0].id] }), /INVALID_LLM_ID/);
});

test('无姓名同技能候选不会导致整批失败；公开职称或城市可区分回退理由', async () => {
  const pair = [person('anon-a', '', '端侧推理'), person('anon-b', '', '端侧推理')];
  const payload = { ...input(), candidates: pair, local: [] };
  const llm = createLLM({ config: settings, logger: () => {}, fetchImpl: async () => response({ candidates: pair.map(invalid) }) });
  const result = await llm.rerank(payload);
  assert.ok(result.candidates.length >= 1);
  assert.equal(result.candidates.length + result.dropped.length, 2);
  assert.equal(new Set(result.candidates.map(r => r.reason)).size, result.candidates.length);
  assert.equal(result.meta.repairs.length, 2);
  const p = person('public-title', '', '端侧推理', { title: '部署工程师', city: '上海' });
  const used = new Set([repair(payload, p).reason, '擅长端侧推理，你可以从这个方向聊起。']);
  const fixed = repair(payload, p, used);
  assert.match(fixed.reason, /部署工程师|上海/);
  assert.ok(schema.grounded(fixed.reason, p));
});

test('修复后仍重复只丢单条；全被移除时客户端保留本地并诚实降级', async () => {
  const pair = [person('a', '', '端侧推理'), person('b', '', '端侧推理')];
  const fixed = { reason: '端侧推理值得交流。', icebreaker: '聊聊端侧推理吗？' };
  const dropped = [];
  const result = schema.rerank({ candidates: pair.map(p => ({ ...invalid(p), ...fixed })) }, pair,
    { repair: () => fixed, onDrop: (id, code) => dropped.push({ id, code }) });
  assert.equal(result.length, 1);
  assert.deepEqual(dropped, [{ id: 'b', code: 'DUPLICATE_REASON' }]);
  const local = pair.map(p => engine.score(input().me, p));
  const llm = client.create(config.llm, engine, { fetchImpl: async url => ({ ok: true, json: async () =>
    url.endsWith('/health') ? { ok: true, timeoutMs: 1 } : { candidates: [], dropped: ['a', 'b'] } }) });
  const response = await llm.rerank(input().me, input().intent, local);
  assert.equal(response.engine, 'local');
  assert.equal(response.error, 'NO_SAFE_RECOMMENDATIONS');
  assert.deepEqual(response.rows, engine.mmr(local));
});

test('全职CTO规则读取配置、合并已有合作方式，否定和提供部分不误命中', () => {
  assert.deepEqual(engine.parseIntent('找全职技术合伙人，也可以早期员工加入').cooperation.sort(), ['早期员工', '联合创始人'].sort());
  for (const value of ['不要全职CTO', '不找全职技术合伙人', '无需全职 CTO', '我能提供全职CTO'])
    assert.equal(engine.parseIntent(value).cooperation, undefined);
  assert.deepEqual(engine.parseIntent('不要全职CTO，但想找早期员工').cooperation, ['早期员工']);
  const custom = require('../src/core/matcher').create({ ...config,
    synonyms: { ...config.synonyms, intentRules: [{ pattern: '特邀专家', field: 'cooperation', values: ['项目制'] }] } });
  assert.deepEqual(custom.parseIntent('找特邀专家').cooperation, ['项目制']);
  assert.equal(custom.parseIntent('找全职CTO').cooperation, undefined);
});

test('18人就业意图与档案一致，冲突的反向就业因子按配置降分，隐藏意图不生效', () => {
  for (const p of data.people.slice(60)) for (const session of Object.values(p.sessions))
    assert.deepEqual(session.intent.employment, p.profile.employment);
  const raw = data.people.find(p => p.id === 'person-63');
  const candidate = { ...raw, session: raw.sessions['ai-agent-night'] };
  const me = engine.project(require('../scripts/eval-ai-scenarios').scenarios()[0].me);
  me.profile.employment = ['在职'];
  if (!me.visibleFields.includes('employment')) me.visibleFields.push('employment');
  const conflict = engine.score(me, candidate).factors.needBA;
  const noPreference = structuredClone(candidate);
  delete noPreference.session.intent.employment;
  const baseline = engine.score(me, noPreference).factors.needBA;
  assert.ok(baseline > 0);
  assert.ok(Math.abs(conflict / baseline - config.matching.conflictingPreference) < 1e-8);
  const hidden = structuredClone(candidate);
  hidden.session.publicIntent = false;
  const before = engine.score(me, hidden);
  hidden.session.intent.employment = ['已离职'];
  assert.deepEqual(engine.score(me, hidden), before);
});

test('休闲简介各自撰写；行顺序反转仍锁定人物ID、头像、状态及资本场成员', () => {
  const people = data.people.slice(60);
  assert.equal(new Set(people.map(p => p.versions.find(v => v.id === 'casual').bio)).size, 18);
  for (const p of people) assert.notEqual(p.versions.find(v => v.id === 'casual').bio, p.profile.bio);
  assert.equal(people.find(p => p.id === 'person-68').sessions['ai-agent-night'].status, 'registered');
  assert.equal(people.find(p => p.id === 'person-69').sessions['ai-agent-night'].openToChat, false);
  for (const id of ['person-63', 'person-68', 'person-73']) assert.ok(people.find(p => p.id === id).sessions['deeptech-capital']);
  const context = { window: { BJ: { data: { people: [] } } } };
  const source = fs.readFileSync(require.resolve('../src/data/ai-people'), 'utf8');
  vm.runInNewContext(source.replace('rows.map(r =>', 'rows.slice().reverse().map(r =>'), context);
  const reordered = context.window.BJ.data.people;
  // This isolates AI catalogue ordering; optional dating enrichment runs afterwards.
  for (const p of people) {
    const base = JSON.parse(JSON.stringify(p));
    require('../src/config/dating').fields.forEach(k => delete base.profile[k]);
    base.versions = base.versions.filter(v => v.id !== 'dating');
    assert.equal(JSON.stringify(reordered.find(other => other.id === p.id)), JSON.stringify(base));
  }
});

test('AbortError优先映射LLM_ABORTED；其他code保留，诊断有活动和阶段、不含原始消息', () => {
  const logs = [];
  const abort = new DOMException('PRIVATE ERROR', 'AbortError');
  assert.equal(client.diagnostic(abort, { eventId: 'ai-agent-night', phase: 'pending' }, e => logs.push(e)), 'LLM_ABORTED');
  const error = Object.assign(Error('SECRET contact@example.com'), { code: 'ERR_HTTP2_STREAM_ERROR' });
  assert.equal(client.diagnostic(error, { eventId: 'demo-day', phase: 'failed' }, e => logs.push(e)), error.code);
  assert.equal(logs[0].eventId, 'ai-agent-night');
  assert.equal(logs[1].phase, 'failed');
  assert.doesNotMatch(JSON.stringify(logs), /SECRET|PRIVATE|contact@example.com/);
  const state = require('../src/core/progressive').create();
  const local = [{ id: 'local' }];
  state.settle(state.begin(local), { engine: 'local', error: client.errorCode(abort) });
  assert.equal(state.get().phase, 'failed');
  assert.equal(state.get().error, 'LLM_ABORTED');
  assert.equal(state.get().rows, local);
});

test('直接upstream.request中途取消走signal.reason分类，不依赖LLM层Promise竞态', async () => {
  for (const code of ['LLM_ABORTED', 'LLM_TIMEOUT']) {
    const controller = new AbortController();
    let started;
    const ready = new Promise(resolve => started = resolve);
    const request = require('../server/upstream').request({ config: settings, prompt: 'test', signal: controller.signal,
      fetchImpl: async (_, options) => { started(); return new Promise((_, reject) =>
        options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })); } });
    await ready;
    controller.abort(Object.assign(Error(code), { code }));
    await assert.rejects(request, error => error.code === code);
  }
});
