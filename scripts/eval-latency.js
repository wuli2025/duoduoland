const fs = require('node:fs');
const path = require('node:path');
const { createLLM } = require('../server/llm.js');
const { config: readConfig } = require('../server/config.js');
async function measure({ data, config, engine }) {
  const server = readConfig();
  const me = { ...data.me, session: data.defaultParticipation };
  const eventId = config.app.defaultEvent;
  const people = data.people.filter(p => p.sessions[eventId]).map(p => ({ ...p, session: p.sessions[eventId] }));
  const baselinePrompt = fs.readFileSync(path.join(__dirname, '../prompts/rerank-baseline.md'), 'utf8');
  const results = [];
  for (const baseline of [true, false]) {
    const llm = createLLM({ config: { ...server, cacheTtl: 300000,
      compactInput: !baseline, maxOutputTokens: baseline ? 0 : server.maxOutputTokens },
      templateOverrides: baseline ? { rerank: baselinePrompt } : {} });
    const rows = engine.rank(me, people, { limit: baseline ? 12 : config.llm.candidateCount, lambda: 1 });
    const payload = { eventId, intent: me.session.intent, me: engine.project(me), candidates: rows.map(r => r.public),
      local: rows.map(r => ({ id: r.id, score: r.score, fresh: r.factors.fresh, ...r.interaction })) };
    const start = performance.now();
    try {
      const result = await llm.rerank(payload);
      const elapsedMs = Math.round(performance.now() - start);
      const cacheStart = performance.now();
      const cached = await llm.rerank(payload);
      results.push({ variant: baseline ? '对照：12人/50字理由/120字话题/无token上限' : '优化：10人/40字理由/20字话题/token上限',
        elapsedMs, cacheMs: Math.round(performance.now() - cacheStart), cache: cached.meta.cache,
        count: result.candidates.length, reasonRepairs: result.meta.repairs, dropped: result.meta.dropped });
    } catch (error) {
      results.push({ variant: baseline ? '对照' : '优化', error: error.code || 'LLM_FAILED', elapsedMs: Math.round(performance.now() - start) });
    }
  }
  return results;
}
module.exports = { measure };
