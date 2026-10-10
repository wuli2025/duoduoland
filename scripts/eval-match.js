const { scenarios, check } = require('./eval-scenarios.js');
const { technicalScenarios } = require('./eval-ai-scenarios.js');
const { createLLM } = require('../server/llm.js');
const { config: readConfig } = require('../server/config.js');
const { fuse } = require('../src/core/llm-client.js');
const demo = require('./load-demo.js')();
const { data, config, engine } = demo;
async function main() {
  const serverConfig = readConfig();
  const available = !!(serverConfig.key && serverConfig.baseUrl && serverConfig.model) && !process.argv.includes('--local');
  const llm = createLLM({ config: serverConfig });
  const all = [...scenarios(), ...technicalScenarios()];
  const record = { date: new Date().toISOString(), timeoutMs: serverConfig.timeout,
    candidateCount: config.llm.candidateCount, scenarios: [], latency: [] };
  const save = () => require('./eval-storage.js').save(record);
  for (const scenario of all) {
    const people = data.people.filter(p => p.sessions[scenario.eventId]).map(p => ({ ...p, session: p.sessions[scenario.eventId] }));
    const start = performance.now();
    const recalled = engine.rank(scenario.me, people, { limit: config.llm.candidateCount, lambda: 1 });
    const local = engine.mmr(recalled, 5);
    const entry = { name: scenario.name, eventId: scenario.eventId, technical: scenario.technical,
      intent: scenario.me.session.intent, localMs: Math.round(performance.now() - start),
      local, localCheck: check(scenario, local, people, engine, config.synonyms) };
    record.scenarios.push(entry);
    if (available) {
      const began = performance.now();
      try {
        const payload = { eventId: scenario.eventId, intent: scenario.me.session.intent,
          me: engine.project(scenario.me), candidates: recalled.map(r => r.public),
          local: recalled.map(r => ({ id: r.id, score: r.score, fresh: r.factors.fresh, ...r.interaction })) };
        const result = await llm.rerank(payload);
        entry.llmMs = Math.round(performance.now() - began);
        entry.remote = fuse(recalled, result.candidates, config.llm, engine, 5, result.dropped);
        entry.remoteCheck = check(scenario, entry.remote, people, engine, config.synonyms);
        entry.evidenceCheck = entry.remote.every(r => require('../src/core/llm-schema').grounded(r.reason, r.public));
        entry.addressCheck = entry.remote.every(r => !/您/.test(r.reason + r.icebreaker));
        entry.reasonRepairs = result.meta.repairs;
        entry.dropped = result.meta.dropped;
        const cacheStart = performance.now();
        entry.cache = (await llm.rerank(payload)).meta.cache;
        entry.cacheMs = Math.round(performance.now() - cacheStart);
      } catch (error) {
        entry.error = error.code || 'LLM_FAILED';
        entry.llmMs = Math.round(performance.now() - began);
      }
    }
    save();
    console.log(JSON.stringify({ scenario: entry.name, local: entry.localCheck.pass,
      llm: entry.remoteCheck?.pass || false, durationMs: entry.llmMs, error: entry.error }));
  }
  if (available) {
    record.latency = await require('./eval-latency.js').measure(demo);
    save();
  }
  require('./eval-report.js')(record);
}
main().catch(() => { console.error('EVALUATION_FAILED'); process.exitCode = 1; });
