const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function config(env = process.env) {
  const file = {};
  const location = path.join(root, '.env.local');
  if (fs.existsSync(location)) {
    for (const line of fs.readFileSync(location, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (match) file[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  const values = { ...file, ...env };
  const positive = (key, fallback) => Number(values[key]) > 0 ? Number(values[key]) : fallback;
  return {
    root, key: values.OPENAI_API_KEY, baseUrl: (values.LLM_BASE_URL || '').replace(/\/$/, ''),
    model: values.LLM_MODEL, timeout: positive('LLM_TIMEOUT_MS', 60000),
    maxOutputTokens: positive('LLM_MAX_OUTPUT_TOKENS', 2600),
    cacheTtl: values.LLM_CACHE_TTL_MS === '0' ? 0 : positive('LLM_CACHE_TTL_MS', 300000),
    cacheEntries: positive('LLM_CACHE_ENTRIES', 64),
    reasoningEffort: values.LLM_REASONING_EFFORT || 'low',
    concurrency: positive('LLM_CONCURRENCY', 2), port: positive('PORT', 8787),
    portAttempts: positive('PORT_ATTEMPTS', 10),
  };
}
module.exports = { config, root };
