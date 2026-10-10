(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./llm-schema.js'), require('./intent-tools'));
  else root.BJ.llmClient = factory(root.BJ.llmSchema, root.BJ.intentTools);
})(typeof window !== 'undefined' ? window : globalThis, function (schema, intents) {
  const named = code => Object.assign(new Error(code), { code });
  const errorCode = error => error?.name === 'AbortError' ? 'LLM_ABORTED'
    : /^[\w.-]{1,64}$/.test(String(error?.code || '')) ? error.code : 'LLM_FAILED';
  function metadata(value) {
    if (!value || typeof value.model !== 'string' || !value.model.trim() || value.model.length > 120 ||
        !Number.isFinite(value.durationMs) || value.durationMs < 0 || typeof value.cached !== 'boolean' ||
        !Number.isFinite(Date.parse(value.cachedAt)) ||
        !/^[\w-]{1,100}$/.test(value.correlationId || '') ||
        (value.cached && (!Number.isFinite(value.upstreamMs) || value.upstreamMs < 0))) throw named('INVALID_LLM_META');
    return Object.fromEntries(['model', 'durationMs', 'cached', 'cachedAt', 'completedAt', 'correlationId',
      'sourceCorrelationId', 'upstreamMs', 'cache'].filter(key => value[key] !== undefined).map(key => [key, value[key]]));
  }
  function diagnostic(error, context = {}, logger = entry => console.warn(JSON.stringify(entry))) {
    const code = errorCode(error);
    logger({ operation: 'match-rerank', status: 'error', code,
      eventId: /^[\w-]{1,80}$/.test(context.eventId || '') ? context.eventId : '',
      phase: ['reading', 'recalled', 'llm-pending', 'done', 'cached', 'pending', 'local', 'failed', 'llm'].includes(context.phase) ? context.phase : 'pending',
      message: '推荐请求未完成' });
    return code;
  }
  function fuse(rows, remote, config, engine, count = 5, dropped = [], context = {}) {
    const validated = schema.rerank({ candidates: remote }, rows.map(r => schema.projection(r.public)),
      { dropped, mode: context.intent?.mode, me: context.me });
    if (!validated.length) schema.fail('NO_SAFE_RECOMMENDATIONS');
    const byId = new Map(validated.map(r => [r.id, r]));
    const total = config.weights.llm + config.weights.local;
    if (!(total > 0)) schema.fail('INVALID_WEIGHTS');
    return engine.mmr(rows.filter(row => byId.has(row.id)).map(row => {
      const result = byId.get(row.id);
      const blend = (a, b) => (a * config.weights.local + b * config.weights.llm) / total;
      return { ...row, localScore: row.score, llmScore: result.score,
        score: Math.round(blend(row.score, result.score)), reason: result.reason, icebreaker: result.icebreaker,
        ...(context.intent?.mode === 'dating' ? { fitReason: result.fitReason } : {}),
        factors: { ...row.factors, ...Object.fromEntries(schema.factors.map(key => [key, blend(row.factors[key], result[key])])) } };
    }), count);
  }
  function create(config, engine, { fetchImpl = globalThis.fetch, protocol = globalThis.location?.protocol || 'http:' } = {}) {
    let negotiatedTimeout = null;
    let model = '';
    let compatibility = { checked: false, mismatch: false };
    async function timeoutMs(signal) {
      if (negotiatedTimeout !== null) return negotiatedTimeout;
      const duration = Math.min(1200, config.timeout);
      let timer;
      try {
        const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(named('HEALTH_TIMEOUT')), duration); });
        const status = await Promise.race([(async () => {
          const health = await fetchImpl(config.endpoint.replace(/\/llm$/, '/health'), {
            signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(duration)]) : AbortSignal.timeout(duration) });
          if (!health.ok) throw named('HEALTH_FAILED');
          return health.json();
        })(), deadline]);
        compatibility = { checked: true, mismatch: !!config.appVersion && status.appVersion !== config.appVersion, appVersion: status.appVersion || '' };
        if (status.ok && Number.isFinite(status.timeoutMs) && status.timeoutMs <= 120000) {
          model = typeof status.model === 'string' ? status.model : '';
          negotiatedTimeout = Math.max(config.timeout, status.timeoutMs + 2000);
        }
      } catch (_) { /* Failed negotiation is retried next time. */ }
      finally { clearTimeout(timer); }
      return negotiatedTimeout ?? config.timeout;
    }
    async function post(kind, payload, externalSignal, onRequest) {
      if (!config.enabled || protocol === 'file:') throw named('LLM_OFFLINE');
      if (externalSignal?.aborted) throw named('LLM_ABORTED');
      const duration = await timeoutMs(externalSignal);
      if (kind === 'rerank' && payload.intent?.mode === 'dating' && compatibility.mismatch) throw named('APP_VERSION_MISMATCH');
      if (externalSignal?.aborted) throw named('LLM_ABORTED');
      const controller = new AbortController();
      let timer, abort;
      const deadline = new Promise((_, reject) => {
        abort = () => { reject(named('LLM_ABORTED')); controller.abort(); };
        externalSignal?.addEventListener('abort', abort, { once: true });
        timer = setTimeout(() => { reject(named('LLM_TIMEOUT')); controller.abort(); }, duration);
      });
      try {
        return await Promise.race([(async () => {
          let response;
          try {
            onRequest?.({ model, startedAt: Date.now() });
            response = await fetchImpl(config.endpoint + '/' + kind, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload), signal: controller.signal });
          } catch (_) { throw named(externalSignal?.aborted ? 'LLM_ABORTED' : 'LLM_NETWORK'); }
          let result;
          try { result = await response.json(); } catch (_) { throw named('LLM_INVALID_JSON'); }
          if (!response.ok) throw named(/^[A-Z_]+$/.test(result?.error || '') ? result.error : 'LLM_UNAVAILABLE');
          return result;
        })(), deadline]);
      } finally {
        clearTimeout(timer);
        externalSignal?.removeEventListener('abort', abort);
      }
    }
    async function rerank(me, intent, rows, count = 5, eventId = '', { signal, onRequest, bypassCache = false } = {}) {
      intent = intents.guard(intent, me.session?.intentText, me.profile);
      rows = rows.filter(row => intents.allowed(engine.project(me), engine.project(row.public || row), intent));
      try {
        if (intents.empty(intent)) throw named('EMPTY_INTENT');
        const payload = schema.request({ eventId, me: engine.project(me), intent,
          candidates: rows.map(row => engine.project(row.public || row)),
          local: rows.map(row => ({ id: row.id, score: row.score, fresh: row.factors?.fresh,
            greeted: row.interaction?.greeted, met: row.interaction?.met })) });
        if (bypassCache) payload.bypassCache = true;
        const result = await post('rerank', payload, signal, onRequest);
        return { rows: fuse(rows, result.candidates, config, engine, count, result.dropped, payload), engine: 'llm', meta: metadata(result.meta) };
      } catch (error) {
        return { rows: engine.mmr(rows, count), engine: 'local', error: errorCode(error) };
      }
    }
    async function parseIntent(text, { signal, ownProfile = {} } = {}) {
      const local = engine.parseIntent(text, ownProfile);
      const ownAge = Number.isInteger(ownProfile.birthYear) ? new Date().getFullYear() - ownProfile.birthYear : undefined;
      try {
        if (!text.trim()) return { intent: local, engine: 'local' };
        const raw = await post('intent', { text: schema.text(text, 800), ownAge }, signal);
        const remote = schema.intent(intents.merge(local, raw));
        return { intent: remote, engine: local.mode === 'dating' && (raw.mode !== 'dating' || raw.targetGender !== local.targetGender) ? 'local' : 'llm' };
      } catch (error) { return { intent: local, engine: 'local', error: errorCode(error) }; }
    }
    async function checkVersion() {
      if (config.enabled && protocol !== 'file:') await timeoutMs();
      return compatibility;
    }
    return { rerank, parseIntent, checkVersion, compatibility: () => compatibility };
  }
  return { create, fuse, errorCode, diagnostic, metadata };
});
