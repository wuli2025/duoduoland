const test = require('node:test');
const assert = require('node:assert/strict');
const { createLLM } = require('../server/llm');
const { createCache } = require('../server/cache');
const { data, config, engine } = require('../scripts/load-demo')();
const settings = { key: 'SECRET-TEST', baseUrl: 'https://test.invalid', model: 'model', timeout: 100,
  concurrency: 1, cacheTtl: 1000, reasoningEffort: 'low', maxOutputTokens: 2600 };
const me = { ...data.me, session: require('./professional-session') };
const publicPerson = engine.project({ ...data.people[0], session: data.people[0].sessions['ai-agent-night'] });
const input = () => ({ eventId: 'ai-agent-night', me: engine.project(me), intent: me.session.intent, candidates: [structuredClone(publicPerson)] });
const result = () => ({ candidates: [{ id: publicPerson.id, needAB: 0.8, needBA: 0.5,
  complement: 0.4, common: 0.3, score: 85, reason: '陈屿公开了端侧 AI', icebreaker: '怎样验证端侧 AI产品？' }] });
const response = () => ({ ok: true, json: async () => ({ output_text: JSON.stringify(result()) }) });
test('服务内存缓存按活动/意图/公开投影区分，隐藏附加值不进入缓存键', async () => {
  let calls = 0;
  const llm = createLLM({ config: settings, logger: () => {}, fetchImpl: async () => { calls++; return response(); } });
  assert.equal((await llm.rerank(input())).meta.cache, 'miss');
  const polluted = input();
  polluted.candidates[0].profile.contact = 'HIDDEN@example.com';
  assert.equal((await llm.rerank(polluted)).meta.cache, 'hit');
  assert.equal(calls, 1);
  const otherEvent = input();
  otherEvent.eventId = 'demo-day';
  await llm.rerank(otherEvent);
  const otherIntent = input();
  otherIntent.intent = { ...otherIntent.intent, seekSkills: ['RAG 知识库'] };
  await llm.rerank(otherIntent);
  const changedPrivacy = input();
  changedPrivacy.candidates[0].visibleFields = changedPrivacy.candidates[0].visibleFields.filter(k => k !== 'experience');
  await llm.rerank(changedPrivacy);
  assert.equal(calls, 4);
});
test('缓存TTL到期与容量淘汰，读结果不允许修改缓存', async () => {
  let time = 0;
  let calls = 0;
  const cache = createCache({ ttl: 20, maxEntries: 1, now: () => time });
  const work = async () => ({ count: ++calls });
  const first = await cache.getOrRun('a', work);
  first.result.count = 999;
  assert.equal((await cache.getOrRun('a', work)).result.count, 1);
  time = 21;
  assert.equal((await cache.getOrRun('a', work)).cache, 'miss');
  await cache.getOrRun('b', work);
  assert.equal((await cache.getOrRun('a', work)).cache, 'miss');
});
test('相同活动并发请求合并，只调用一次上游，失败不入缓存', async () => {
  let release;
  let calls = 0;
  const llm = createLLM({ config: settings, logger: () => {}, fetchImpl: async () => {
    calls++;
    await new Promise(resolve => release = resolve);
    return response();
  } });
  const first = llm.rerank(input());
  const second = llm.rerank(input());
  release();
  assert.equal((await first).meta.cache, 'miss');
  assert.equal((await second).meta.cache, 'shared');
  assert.equal(calls, 1);
  const cache = createCache();
  await assert.rejects(cache.getOrRun('bad', async () => { throw new Error('fail'); }));
  assert.equal((await cache.getOrRun('bad', async () => 'ok')).cache, 'miss');
});
test('不支持reasoning时只移除该参数重发，并记录安全的具名兼容事件', async () => {
  let calls = 0;
  const logs = [];
  const llm = createLLM({ config: settings, logger: e => logs.push(e), fetchImpl: async (_, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.max_output_tokens, 2600);
    if (++calls === 1) {
      assert.equal(body.reasoning.effort, 'low');
      return { ok: false, status: 400, json: async () => ({ error: {
        param: 'reasoning.effort', code: 'unsupported_parameter', message: 'SECRET-TEST unsupported reasoning',
      } }) };
    }
    assert.equal(body.reasoning, undefined);
    return response();
  } });
  await llm.rerank(input());
  assert.equal(calls, 2);
  assert.ok(logs.some(e => e.code === 'REASONING_UNSUPPORTED'));
  assert.doesNotMatch(JSON.stringify(logs), /SECRET-TEST|端侧|prompt/);
});
test('token预算用尽的incomplete结果不能误标成功或写入缓存', async () => {
  const llm = createLLM({ config: settings, logger: () => {}, fetchImpl: async () => ({ ok: true,
    json: async () => ({ status: 'incomplete', output_text: JSON.stringify(result()) }) }) });
  await assert.rejects(llm.rerank(input()), /LLM_INCOMPLETE/);
});
