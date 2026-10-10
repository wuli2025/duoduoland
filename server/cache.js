const crypto = require('node:crypto');
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function createCache({ ttl = 300000, maxEntries = 64, now = Date.now } = {}) {
  const entries = new Map();
  const pending = new Map();
  const latest = new Map();
  let generation = 0;
  const key = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
  async function getOrRun(identity, work, signal, { bypass = false } = {}) {
    const aborted = () => Object.assign(new Error('LLM_ABORTED'), { code: 'LLM_ABORTED' });
    if (signal?.aborted) throw aborted();
    const id = key(identity);
    for (const [key, entry] of entries) if (entry.expires <= now()) entries.delete(key);
    if (!bypass && ttl > 0 && entries.has(id)) return { result: structuredClone(entries.get(id).result), cache: 'hit' };
    let entry = !bypass && ttl > 0 && pending.get(id);
    const shared = !!entry;
    if (!entry) {
      entry = { controller: new AbortController(), users: 0, generation: ++generation };
      latest.set(id, entry.generation);
      entry.promise = (async () => {
        const result = await work(entry.controller.signal);
        if (entry.controller.signal.aborted) throw aborted();
        if (ttl > 0 && latest.get(id) === entry.generation) {
          if (entries.size >= maxEntries) entries.delete(entries.keys().next().value);
          entries.set(id, { result: structuredClone(result), expires: now() + ttl });
        }
        return result;
      })().finally(() => {
        if (pending.get(id) === entry) pending.delete(id);
        if (latest.get(id) === entry.generation) latest.delete(id);
      });
      if (!bypass && ttl > 0) pending.set(id, entry);
    }
    entry.users++;
    let onAbort;
    const cancellation = new Promise((_, reject) => {
      onAbort = () => reject(aborted());
      signal?.addEventListener('abort', onAbort, { once: true });
    });
    try {
      const result = await Promise.race([entry.promise, cancellation]);
      return { result: structuredClone(result), cache: shared ? 'shared' : 'miss' };
    } finally {
      signal?.removeEventListener('abort', onAbort);
      if (--entry.users === 0) {
        entry.controller.abort();
        if (pending.get(id) === entry) pending.delete(id);
      }
    }
  }
  return { getOrRun };
}
module.exports = { createCache };
