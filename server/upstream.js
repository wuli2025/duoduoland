const { fail } = require('../src/core/llm-schema.js');
async function request({ config, fetchImpl, prompt, signal, onCompatibility }) {
  const abort = () => fail(signal.reason?.code === 'LLM_TIMEOUT' ? 'LLM_TIMEOUT' : 'LLM_ABORTED');
  const body = { model: config.model, input: prompt,
    ...(config.maxOutputTokens === 0 ? {} : { max_output_tokens: config.maxOutputTokens || 2600 }),
    text: { format: { type: 'json_object' } },
    ...(config.reasoningEffort ? { reasoning: { effort: config.reasoningEffort } } : {}) };
  let networkRetries = 0;
  let ignoredReasoning = false;
  while (true) {
    if (signal.aborted) abort();
    let response;
    try {
      response = await fetchImpl(config.baseUrl + '/responses', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.key },
        body: JSON.stringify(body),
      });
    } catch (_) {
      if (signal.aborted) abort();
      if (networkRetries++ === 0) continue;
      fail('LLM_NETWORK');
    }
    if (!response.ok) {
      let error;
      if ([400, 422].includes(response.status)) {
        try { error = (await response.json()).error; } catch (_) { /* Never log raw upstream errors. */ }
      }
      const unsupported = error && (/^reasoning(?:\.|$)/.test(error.param || '') ||
        /reasoning/i.test(error.message || '')) && /unsupported|not.support|unknown|unrecognized/i.test(
        [error.code, error.message].join(' '));
      if (unsupported && body.reasoning && !ignoredReasoning) {
        delete body.reasoning;
        ignoredReasoning = true;
        onCompatibility('REASONING_UNSUPPORTED');
        continue;
      }
      throw Object.assign(new Error('LLM_UPSTREAM_HTTP'), { code: 'LLM_UPSTREAM_HTTP', httpStatus: response.status });
    }
    let envelope;
    try { envelope = await response.json(); } catch (_) {
      if (signal.aborted) abort();
      fail('LLM_INVALID_JSON');
    }
    if (signal.aborted) abort();
    if (envelope.status === 'incomplete') fail('LLM_INCOMPLETE');
    if (envelope.status && envelope.status !== 'completed') fail('LLM_UPSTREAM_STATUS');
    const output = envelope.output_text || (envelope.output || []).flatMap(item => item.content || [])
      .filter(item => item.type === 'output_text').map(item => item.text).join('');
    try { return JSON.parse(output); } catch (_) { fail('LLM_INVALID_JSON'); }
  }
}
module.exports = { request };
