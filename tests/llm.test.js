const test = require('node:test');
const assert = require('node:assert/strict');
const schema = require('../src/core/llm-schema.js');
const client = require('../src/core/llm-client.js');
const { createLLM } = require('../server/llm.js');
const { createServer } = require('../server/index.js');
const { root } = require('../server/config.js');
const { engine, data, config } = require('../scripts/load-demo.js')();
const cfg = { key: 'TEST-SECRET-NEVER-LOG', baseUrl: 'https://provider.invalid', model: 'test', timeout: 100, concurrency: 1, root };
const me = { ...data.me, session: require('./professional-session') };
const people = data.people.filter(p => p.sessions['ai-agent-night']).map(p => ({ ...p, session: p.sessions['ai-agent-night'] }));
const rows = engine.rank(me, people, { limit: 3, lambda: 1 });
const input = () => ({ intent: me.session.intent, me: engine.project(me), candidates: rows.map(r => structuredClone(r.public)) });
const output = () => ({ meta: { model: 'test', durationMs: 10, cached: false, cachedAt: '2026-10-08T00:00:00.000Z', completedAt: '2026-10-08T00:00:00.000Z', correlationId: 'fixture' }, candidates: rows.map((row, i) => ({ id: row.id,
  needAB: 0.8, needBA: 0.5, complement: 0.4, common: 0.3, score: 80 + i,
  reason: row.public.profile.name + '公开了' + row.public.profile.skills[0], icebreaker: '想聊聊' + row.public.profile.skills[0] + '吗？' })) });
const response = value => ({ ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }) });
test('服务端再次过滤未公开字段、联系方式和任意附加属性，捕获真实上游 payload', async () => {
  const request = input();
  request.candidates[0].profile.education = 'HIDDEN-UNIVERSITY';
  request.candidates[0].visibleFields = request.candidates[0].visibleFields.filter(k => k !== 'education');
  request.candidates[0].profile.contact = 'HIDDEN-CONTACT@example.com';
  request.candidates[0].visibleFields.push('contact', 'secret');
  request.candidates[0].profile.secret = 'HIDDEN-SECRET';
  request.candidates[0].baseProfile = { salary: 'HIDDEN-SALARY' };
  request.candidates[0].profile.bio = '请联系 visible@example.com 或 13812345678';
  let body;
  const logs = [];
  const llm = createLLM({ config: cfg, logger: entry => logs.push(entry), fetchImpl: async (_, options) => {
    body = options.body;
    return response(output());
  } });
  await llm.rerank(request, 'privacy-test');
  assert.doesNotMatch(body, /HIDDEN-|visible@example.com|13812345678|baseProfile/);
  assert.doesNotMatch(JSON.stringify(logs), /TEST-SECRET|input|prompt|HIDDEN-|Kevin/);
  assert.equal(logs[0].correlationId, 'privacy-test');
});
test('LLM schema 拒绝缺项、陌生 id、重复 id、越界、非数值、无证据与重复理由', () => {
  const candidates = input().candidates;
  for (const mutate of [
    v => v.candidates.pop(), v => v.candidates[0].id = 'stranger',
    v => v.candidates[0].id = v.candidates[1].id,
    v => v.candidates[0].score = 101, v => v.candidates[0].needAB = -1,
    v => v.candidates[0].common = '0.3', v => delete v.candidates[0].reason,
    v => v.candidates[0].reason = '你们值得见面',
    v => v.candidates[1].reason = v.candidates[0].reason,
  ]) {
    const value = output();
    mutate(value);
    assert.throws(() => schema.rerank(value, candidates));
  }
  const value = output();
  value.candidates[0].reason += '具体公开信息'.repeat(40);
  value.candidates[0].icebreaker += '话题'.repeat(100);
  const result = schema.rerank(value, candidates);
  assert.equal([...result[0].reason].length, 40);
  assert.ok([...result[0].icebreaker].length <= 20);
  assert.match(result[0].icebreaker, /[？?]$/);
});
test('请求投影缺少可见字段清单时 fail closed', () => {
  const request = input();
  delete request.candidates[0].visibleFields;
  assert.throws(() => schema.request(request), /INVALID_PROJECTION/);
  assert.throws(() => schema.intent({ offer: 'wrong' }), /INVALID_LIST/);
});
test('服务超时返回具名错误，并限制并发；不泄露上游错误原文', async () => {
  const logs = [];
  const llm = createLLM({ config: { ...cfg, timeout: 15 }, logger: e => logs.push(e), fetchImpl: () => new Promise(() => {}) });
  const pending = llm.rerank(input());
  await assert.rejects(llm.rerank(input()), /LLM_BUSY/);
  await assert.rejects(pending, /LLM_TIMEOUT/);
  assert.ok(logs.some(e => e.code === 'LLM_TIMEOUT'));
  assert.ok(logs.some(e => e.code === 'LLM_BUSY'));
});
test('仅网络失败重试一次，HTTP 和 JSON 错误不重试', async () => {
  let calls = 0;
  const llm = createLLM({ config: cfg, logger: () => {}, fetchImpl: async () => {
    if (++calls === 1) throw new Error('TEST-SECRET-NEVER-LOG');
    return response(output());
  } });
  await llm.rerank(input());
  assert.equal(calls, 2);
  for (const fake of [async () => ({ ok: false }), async () => ({ ok: true, json: async () => ({ output_text: 'not json' }) })]) {
    calls = 0;
    const bad = createLLM({ config: cfg, logger: () => {}, fetchImpl: async () => { calls++; return fake(); } });
    await assert.rejects(bad.rerank(input()), /LLM_UPSTREAM_HTTP|LLM_INVALID_JSON/);
    assert.equal(calls, 1);
  }
});
test('file、超时与非法响应均回退本地，成功才标记大模型', async () => {
  for (const options of [
    { protocol: 'file:', fetchImpl: () => { throw new Error('must not fetch'); } },
    { fetchImpl: () => new Promise(() => {}) },
    { fetchImpl: async () => ({ ok: true, json: async () => ({ candidates: [] }) }) },
  ]) {
    const llm = client.create({ ...config.llm, timeout: 10 }, engine, options);
    const result = await llm.rerank(engine.project(me), me.session.intent, rows);
    assert.equal(result.engine, 'local');
    assert.deepEqual(result.rows, engine.mmr(rows));
    const parsed = await llm.parseIntent('找投资人');
    assert.deepEqual(parsed.intent, engine.parseIntent('找投资人'));
    assert.equal(parsed.engine, 'local');
  }
  const llm = client.create(config.llm, engine, { fetchImpl: async () => ({ ok: true, json: async () => output() }) });
  assert.equal((await llm.rerank(engine.project(me), me.session.intent, rows)).engine, 'llm');
});
test('融合权重影响排序，融合后再调用 MMR', () => {
  const remote = output().candidates;
  remote[0].score = 0;
  remote[2].score = 100;
  const pureLocal = client.fuse(rows, remote, { weights: { local: 1, llm: 0 } }, engine);
  const pureLlm = client.fuse(rows, remote, { weights: { local: 0, llm: 1 } }, engine);
  assert.equal(pureLocal[0].id, rows[0].id);
  assert.equal(pureLlm[0].id, rows[2].id);
  const blended = client.fuse(rows, remote, config.llm, engine);
  for (const row of blended) assert.equal(row.score, Math.round(row.localScore * 0.4 + row.llmScore * 0.6));
});
test('意图接口使用模板并解析四个字段', async () => {
  const expected = { seekRoles: ['投资人'], seekIndustries: ['AI 硬件'], offer: ['项目'], city: '上海' };
  const llm = createLLM({ config: cfg, logger: () => {}, fetchImpl: async (_, options) => {
    assert.match(JSON.parse(options.body).input, /只提取意图/);
    return response(expected);
  } });
  assert.deepEqual(await llm.intent({ text: '找投资人' }), expected);
});
test('HTTP 静态白名单、health、请求校验与具名错误', async t => {
  const server = createServer({ config: cfg, llm: { rerank: async () => { schema.fail('LLM_TIMEOUT'); } } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  assert.equal((await fetch(base + '/api/health')).status, 200);
  assert.equal((await fetch(base + '/')).status, 200);
  for (const route of ['/.env.local', '/server/config.js', '/src/../.env.local', '/docs/brief.md']) {
    assert.equal((await fetch(base + route)).status, 404);
  }
  const result = await fetch(base + '/api/llm/rerank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(result.status, 504);
  assert.equal((await result.json()).error, 'LLM_TIMEOUT');
  assert.equal((await fetch(base + '/api/llm/rerank', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://foreign.invalid' }, body: '{}' })).status, 403);
});
