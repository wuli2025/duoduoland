const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const schema = require('../src/core/llm-schema.js');
const { createCache } = require('./cache.js');
const { request } = require('./upstream.js');
const { repair, policy } = require('./reason-policy.js');
const versions = require('./cache-versions.js');
const { logError, defaultLogger } = require('./error-log.js');
function createLLM({ config = require('./config.js').config(), fetchImpl = fetch, logger = defaultLogger, templateOverrides = {} } = {}) {
  let active = 0;
  const cache = createCache({ ttl: config.cacheTtl || 0, maxEntries: config.cacheEntries || 64 });
  const templates = Object.fromEntries(['rerank', 'rerank-dating', 'intent'].map(name => [name,
    typeof templateOverrides[name] === 'string' ? templateOverrides[name]
      : fs.readFileSync(path.join(__dirname, '../prompts', name + '.md'), 'utf8')]));
  Object.assign(templates, templateOverrides);
  const named = code => Object.assign(new Error(code), { code });
  async function boundary(operation, correlationId, work) {
    const started = Date.now();
    try { return await work(); }
    catch (error) { throw logError(error, { logger, correlationId, operation, started }); }
  }
  async function call(kind, payload, correlationId, externalSignal) {
    if (!config.key || !config.baseUrl || !config.model) schema.fail('LLM_NOT_CONFIGURED');
    if (active >= config.concurrency) schema.fail('LLM_BUSY');
    if (externalSignal?.aborted) schema.fail('LLM_ABORTED');
    active++;
    const started = Date.now();
    const controller = new AbortController();
    let timer, onAbort;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = named('LLM_TIMEOUT');
          reject(error);
          controller.abort(error);
        }, config.timeout);
      });
      const cancellation = new Promise((_, reject) => {
        onAbort = () => {
          const error = named('LLM_ABORTED');
          reject(error);
          controller.abort(error);
        };
        externalSignal?.addEventListener('abort', onAbort, { once: true });
      });
      const promptPayload = kind === 'rerank'
        ? require('./prompt-input.js').compact(payload, config.compactInput !== false) : payload;
      const template = kind === 'rerank' && payload.intent.mode === 'dating' ? 'rerank-dating' : kind;
      const prompt = templates[template].replace(/\{\{(payload|count|allowCaveat)\}\}/g, (_, key) =>
        key === 'payload' ? JSON.stringify(promptPayload) : key === 'count' ? String(payload.candidates.length)
          : String(require('../src/config/dating').allowCaveat));
      const work = async () => {
        const parsed = await request({ config, fetchImpl, prompt, signal: controller.signal,
          onCompatibility: code => logger({ correlationId, operation: kind, status: 'compatibility', code }) });
        const repairs = [];
        const dropped = [];
        return kind === 'rerank' ? { candidates: schema.rerank(parsed, payload.candidates, {
          mode: payload.intent.mode, me: payload.me,
          repair: (candidate, code, used) => {
            repairs.push({ id: candidate.id, code });
            logger({ correlationId, operation: kind, status: 'repair', code, candidateId: candidate.id });
            return repair(payload, candidate, used);
          },
          onDrop: (candidateId, code) => {
            dropped.push({ id: candidateId, code });
            logger({ correlationId, operation: kind, status: 'drop', code, candidateId });
          },
        }), repairs, dropped } : schema.intent(parsed);
      };
      const result = await Promise.race([work(), timeout, cancellation]);
      logger({ correlationId, operation: kind, status: 'ok', durationMs: Date.now() - started });
      return result;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onAbort);
      active--;
    }
  }
  function rerank(raw, id = crypto.randomUUID(), { signal } = {}) {
    return boundary('rerank', id, async () => {
      const started = Date.now();
      if (raw?.bypassCache !== undefined && typeof raw.bypassCache !== 'boolean') schema.fail('INVALID_BYPASS_CACHE');
      const payload = schema.request(raw);
      const identity = { payload, model: config.model, prompt: templates[payload.intent.mode === 'dating' ? 'rerank-dating' : 'rerank'],
        reasoning: config.reasoningEffort, maxTokens: config.maxOutputTokens,
        policyVersion: policy.version, compactInput: config.compactInput !== false, versions };
      const cached = await cache.getOrRun(identity, async sharedSignal => {
        const began = Date.now();
        const result = await call('rerank', payload, id, sharedSignal);
        return { ...result, upstreamMs: Date.now() - began, generatedAt: new Date().toISOString(), sourceCorrelationId: id };
      }, signal, { bypass: raw.bypassCache === true });
      const durationMs = Date.now() - started;
      logger({ correlationId: id, operation: 'rerank-cache', status: cached.cache, durationMs });
      return { candidates: cached.result.candidates, dropped: cached.result.dropped.map(row => row.id),
        meta: { cache: cached.cache, durationMs, upstreamMs: cached.result.upstreamMs,
          model: config.model, cached: cached.cache === 'hit', cachedAt: cached.result.generatedAt,
          completedAt: cached.result.generatedAt, correlationId: id, sourceCorrelationId: cached.result.sourceCorrelationId,
          repairs: cached.result.repairs, dropped: cached.result.dropped } };
    });
  }
  function intent(raw, id = crypto.randomUUID(), { signal } = {}) {
    return boundary('intent', id, async () => {
      if (raw?.ownAge !== undefined && (!Number.isInteger(raw.ownAge) || raw.ownAge < 18 || raw.ownAge > 99)) schema.fail('INVALID_DATING_AGE');
      return call('intent', { text: schema.text(raw?.text, 800), ...(raw?.ownAge ? { ownAge: raw.ownAge } : {}) }, id, signal);
    });
  }
  return { rerank, intent };
}
module.exports = { createLLM };
