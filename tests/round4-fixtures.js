const { data, engine, config } = require('../scripts/load-demo')();
const schema = require('../src/core/llm-schema');
const me = { ...data.me, session: require('./professional-session') };
const candidate = { ...data.people[0], session: data.people[0].sessions['ai-agent-night'] };
const rows = [engine.score(me, candidate)];
const settings = { key: 'TEST-SECRET', baseUrl: 'https://test.invalid', model: 'test',
  timeout: 100, concurrency: 1, cacheTtl: 1000, reasoningEffort: 'low' };
const input = () => ({ eventId: 'ai-agent-night', me: engine.project(me), intent: me.session.intent,
  candidates: [engine.project(candidate)], local: rows.map(r => ({ id: r.id, score: r.score, fresh: r.factors.fresh })) });
const output = () => ({ meta: { model: 'test', durationMs: 10, cached: false, cachedAt: '2026-10-08T00:00:00.000Z', completedAt: '2026-10-08T00:00:00.000Z', correlationId: 'fixture' }, candidates: rows.map(r => ({ id: r.id, score: 90, needAB: 0.8,
  needBA: 0.7, complement: 0.5, common: 0.4, reason: '陈屿擅长端侧 AI，值得交流。', icebreaker: '如何验证端侧 AI？' })) });
const response = (value = output(), status = 'completed') => ({ ok: true,
  json: async () => ({ status, output_text: JSON.stringify(value) }) });
module.exports = { data, engine, config, schema, me, candidate, rows, settings, input, output, response };
