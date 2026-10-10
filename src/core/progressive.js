(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.BJ.progressive = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function create({ now = Date.now } = {}) {
    let revision = 0;
    let disposed = false;
    let state = { phase: 'idle', rows: [], pending: false, offline: false };
    const current = token => !disposed && token === revision && !state.offline;
    function begin(rows, { offline = false } = {}) {
      state = { phase: offline ? 'local' : 'reading', rows: offline ? rows : [],
        localRows: rows, pending: !offline, offline, readCount: 0, candidates: [], startedAt: null };
      return ++revision;
    }
    function read(token, count) {
      if (!current(token) || state.phase !== 'reading') return false;
      state = { ...state, readCount: count };
      return true;
    }
    function recall(token, candidates, localRows) {
      if (!current(token) || state.phase !== 'reading') return false;
      state = { ...state, phase: 'recalled', candidates, localRows };
      return true;
    }
    function request(token, { model, startedAt = now() } = {}) {
      if (!current(token) || state.phase !== 'recalled') return false;
      state = { ...state, phase: 'llm-pending', model, startedAt };
      return true;
    }
    function settle(token, result) {
      if (disposed || token !== revision) return false;
      if (state.offline || !state.pending) return false;
      state = result.engine === 'llm'
        ? { ...state, phase: result.meta?.cached ? 'cached' : 'done', rows: result.rows, pending: false, meta: result.meta }
        : { ...state, rows: state.localRows, phase: ['LLM_OFFLINE', 'NO_CANDIDATES'].includes(result.error) ? 'local' : 'failed', pending: false,
          error: result.error || 'LLM_FAILED' };
      state.finishedAt = now();
      return true;
    }
    // Show a previously settled result again without a new request.
    function restore(snapshot) {
      state = { ...snapshot, pending: false, offline: false };
      return ++revision;
    }
    return { begin, read, recall, request, settle, restore, get: () => state,
      elapsed: () => state.startedAt == null ? 0 : Math.max(0, (state.finishedAt ?? now()) - state.startedAt),
      dispose: () => { disposed = true; revision++; } };
  }
  return { create };
});
