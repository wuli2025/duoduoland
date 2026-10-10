(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./dating'), require('../config/intent'));
  else root.BJ.intentTools = factory(root.BJ.dating, root.BJ.config.intent);
})(typeof window !== 'undefined' ? window : globalThis, function (dating, cfg) {
  function guard(intent = {}, text = '', own = {}) {
    const local = dating.parse(String(text), own);
    if (!local) return intent;
    return { ...intent, seekRoles: [], seekIndustries: [], offer: [], city: intent.city || '', ...local,
      interests: intent.mode === 'dating' && Array.isArray(intent.interests) ? intent.interests : local.interests,
      ...(intent.mode === 'dating' ? { lifestyle: intent.lifestyle || [], values: intent.values || [] } : {}) };
  }
  function merge(local, remote) {
    if (local.mode !== 'dating') return remote;
    return { ...remote, ...local, mode: 'dating',
      interests: [...new Set([...(local.interests || []), ...(remote.interests || [])])] };
  }
  function empty(value = {}) {
    return !Object.keys(cfg.labels).some(k => Array.isArray(value[k]) ? value[k].length : value[k]) && value.mode !== 'dating';
  }
  function tags(people, mode = 'professional') {
    const counts = new Map(), mapping = mode === 'dating' ? cfg.dating : cfg.professional;
    for (const p of people) {
      if (mode === 'dating' && !dating.ready(p)) continue;
      const seen = new Set();
      for (const [field, key] of Object.entries(mapping)) {
        if (!p.visibleFields.includes(field)) continue;
        const raw = p.profile[field];
        const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[·、/]/) : [];
        for (const item of values) {
          const value = item.trim(), id = key + ':' + value;
          if (!value || seen.has(id)) continue;
          seen.add(id);
          const row = counts.get(id) || { key, value, count: 0 };
          row.count++; counts.set(id, row);
        }
      }
    }
    return [...counts.values()].sort((a,b) => b.count - a.count || a.key.localeCompare(b.key) || a.value.localeCompare(b.value, 'zh-CN')).slice(0, cfg.limit);
  }
  function toggle(intent, tag) {
    const values = intent[tag.key] || [];
    intent[tag.key] = values.includes(tag.value) ? values.filter(v => v !== tag.value) : [...values, tag.value];
    return intent;
  }
  return { guard, merge, empty, tags, toggle,
    allowed: (me, candidate, query) => query.mode !== 'dating' || dating.eligible(me,candidate,query) };
});
