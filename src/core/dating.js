(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('../config/dating'));
  else root.BJ.dating = factory(root.BJ.config.dating);
})(typeof window !== 'undefined' ? window : globalThis, function (cfg) {
  const age = p => Number.isInteger(p?.birthYear) ? cfg.referenceYear - p.birthYear : null;
  const range = r => Array.isArray(r) && r.length === 2 && r.every(Number.isInteger) && r[0] >= cfg.adultAge && r[1] <= cfg.maxAge && r[0] <= r[1];
  function intent(value = {}) {
    if (value.mode !== 'dating') return {};
    return { mode: 'dating', targetGender: value.targetGender === undefined ? '不限' : value.targetGender,
      ageRange: value.ageRange === undefined ? [cfg.adultAge, cfg.maxAge] : Array.isArray(value.ageRange) ? value.ageRange.slice() : [],
      interests: Array.isArray(value.interests) ? value.interests.filter(v => typeof v === 'string') : [],
      ...Object.fromEntries(['lifestyle','values'].filter(k => Array.isArray(value[k])).map(k => [k, value[k].filter(v => typeof v === 'string')])) };
  }
  function parse(text, own = {}) {
    for (const phrase of cfg.nonDatingPhrases) text = text.replaceAll(phrase, '');
    text = text.split(/[，,；;。]/).filter(clause => !new RegExp(cfg.negation).test(clause)).join('，');
    if (!cfg.triggers.some(word => text.includes(word))) return null;
    const ownAge = age(own);
    let ageRange = [cfg.adultAge, cfg.maxAge];
    if (ownAge !== null) {
      if (cfg.similar.some(w => text.includes(w))) ageRange = [ownAge - cfg.similarYears, ownAge + cfg.similarYears];
      if (cfg.older.some(w => text.includes(w))) ageRange = [ownAge + 1, ownAge + cfg.similarYears];
      if (cfg.younger.some(w => text.includes(w))) ageRange = [ownAge - cfg.similarYears, ownAge - 1];
    }
    const explicit = text.match(/(\d{2})\s*[-–到至]\s*(\d{2})\s*岁?/);
    if (explicit) ageRange = [+explicit[1], +explicit[2]];
    ageRange = [Math.max(cfg.adultAge, ageRange[0]), Math.min(cfg.maxAge, ageRange[1])];
    return intent({ mode: 'dating', targetGender: Object.keys(cfg.genders).find(g => cfg.genders[g].some(w => text.includes(w))) || '不限',
      ageRange, interests: Object.keys(cfg.interests).filter(k => cfg.interests[k].some(w => text.includes(w))) });
  }
  function ready(person) {
    const p = person?.profile || {}, a = age(p), pref = p.datingPreference;
    return person?.cardType === 'dating' && cfg.required.every(k => person.visibleFields.includes(k)) &&
      p.datingOpen === true && p.relationshipStatus === '单身' && ['男', '女'].includes(p.gender) &&
      a >= cfg.adultAge && a <= cfg.maxAge && pref && Array.isArray(pref.genders) &&
      pref.genders.length > 0 && pref.genders.every(g => ['男', '女'].includes(g)) && range(pref.ageRange);
  }
  const accepts = (pref, p) => pref.genders.includes(p.gender) && age(p) >= pref.ageRange[0] && age(p) <= pref.ageRange[1];
  function eligible(me, candidate, query) {
    if (!ready(me) || !ready(candidate) || me.id === candidate.id) return false;
    const a = me.profile, b = candidate.profile, q = intent(query);
    return q.mode === 'dating' && range(q.ageRange) && (q.targetGender === '不限' || b.gender === q.targetGender) &&
      age(b) >= q.ageRange[0] && age(b) <= q.ageRange[1] && accepts(a.datingPreference, b) && accepts(b.datingPreference, a);
  }
  const shared = (a, b, key) => (a[key] || []).filter(v => (b[key] || []).includes(v));
  function topics(a, b) {
    return shared(a, b, 'interests');
  }
  const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key] || '');
  function reasons(me, candidate) {
    const a = me.profile, b = candidate.profile, topic = topics(a, b)[0];
    const values = { name: b.name || '这位朋友', topic, city: a.city };
    const fitReason = fill(topic ? cfg.copy.fit : a.city && a.city === b.city ? cfg.copy.cityFit : cfg.copy.fallbackFit, values);
    return { reason: topic ? fill(cfg.copy.reason, values) : fitReason,
      icebreaker: topic && [...topic].length <= 8 ? fill(cfg.copy.question, values) : cfg.copy.genericQuestion, fitReason };
  }
  function grounded(text, me, candidate) {
    const a = me.profile, b = candidate.profile;
    if (b.name && !text.includes(b.name)) return false;
    return topics(a, b).some(v => text.includes(v)) ||
      ['datingLifestyle', 'datingValues'].some(k => shared(a, b, k).some(v => text.includes(v))) ||
      (!!a.city && a.city === b.city && text.includes(a.city)) ||
      (ready(me) && ready(candidate) && text.includes('本场认识恋爱对象'));
  }
  const safe = text => typeof text === 'string' && !cfg.forbidden.some(word => text.includes(word));
  function variety(me, rows) {
    const used = new Set();
    return rows.map((row, index) => {
      const a = me.profile, b = row.public.profile, name = b.name || '这位朋友';
      const evidence = [];
      const add = (kind, topic) => { if (topic) evidence.push(fill(cfg.fitEvidence[kind], { name, topic })); };
      topics(a,b).forEach(t => add('interest',t));
      shared(a,b,'datingLifestyle').forEach(t => add('lifestyle',t));
      shared(a,b,'datingValues').forEach(t => add('values',t));
      if (a.city === b.city) add('city',a.city);
      if (Math.abs(age(a)-age(b)) <= 5) add('age',topics(a,b)[0]);
      if (!evidence.length) evidence.push(fill(cfg.fitEvidence.consent,{name}));
      for (let n=0; n<cfg.fitTemplates.length; n++) {
        const template = (index+n) % cfg.fitTemplates.length;
        if (used.has(template)) continue;
        const fact = evidence[index % evidence.length];
        const fitReason = fill(cfg.fitTemplates[template], {name,evidence:fact});
        if ([...fitReason].length > 60 || !safe(fitReason) || !grounded(fitReason,me,row.public)) continue;
        used.add(template);
        return {...row,fitReason};
      }
      return row;
    });
  }
  function score(me, candidate, query, options = {}) {
    const a = me.profile, b = candidate.profile;
    const sharedInterest = topics(a, b);
    const common = sharedInterest.length / Math.max(1, Math.min((a.interests || []).length, (b.interests || []).length));
    const requested = query.interests?.length ? query.interests.filter(v => (b.interests || []).includes(v)).length / query.interests.length : common;
    const fraction = key => {
      const selected = query[key === 'datingLifestyle' ? 'lifestyle' : 'values'];
      const wanted = selected?.length ? selected : a[key] || [];
      return wanted.filter(v => (b[key] || []).includes(v)).length / Math.max(1,wanted.length);
    };
    const reverse = intent(candidate.intent), scoring = cfg.score;
    const mutual = reverse.mode !== 'dating' ? scoring.unknownIntent :
      (reverse.targetGender === '不限' || reverse.targetGender === a.gender) && range(reverse.ageRange) &&
        age(a) >= reverse.ageRange[0] && age(a) <= reverse.ageRange[1] ? 1 : 0;
    const factors = { interests: common * (1 - scoring.requestedShare) + requested * scoring.requestedShare,
      lifestyle: fraction('datingLifestyle'), values: fraction('datingValues'),
      city: a.city && a.city === b.city ? 1 : 0, age: Math.max(0, 1 - Math.abs(age(a) - age(b)) / scoring.ageScale),
      mutual, career: 0 };
    const weight = cfg.weights;
    const weightTotal = Object.values(weight).reduce((n, value) => n + value, 0) || 1;
    const raw = Object.keys(weight).reduce((n, k) => n + weight[k] * factors[k], 0) / weightTotal;
    const seen = (options.greeted || []).includes(candidate.id) || (options.met || []).includes(candidate.id);
    const fresh = seen ? scoring.seenMultiplier : 1;
    return { id: candidate.id, mode: 'dating', public: candidate, score: Math.round((scoring.base + scoring.span * raw) * fresh),
      factors: { ...factors, needAB: 1, needBA: mutual, complement: factors.lifestyle, common, fresh, reach: 1, quality: 1 },
      interaction: { greeted: (options.greeted || []).includes(candidate.id), met: (options.met || []).includes(candidate.id) },
      ...reasons(me, candidate) };
  }
  function professional(person) {
    return { ...person, profile: Object.fromEntries(Object.entries(person.profile).filter(([key]) => !cfg.fields.includes(key))) };
  }
  function title(candidate, query) {
    return query.targetGender === '男' && candidate.profile.gender === '男' ? cfg.copy.maleTitle
      : query.targetGender === '女' && candidate.profile.gender === '女' ? cfg.copy.femaleTitle : cfg.copy.neutralTitle;
  }
  return { cfg, age, range, parse, intent, ready, eligible, topics, reasons, grounded, safe, score, professional, title, variety };
});
