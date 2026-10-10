(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./matcher.js'), require('../config/reason-policy.js'), require('./dating'));
  else root.BJ.llmSchema = factory(root.BJ.matcher, root.BJ.config.reasonPolicy, root.BJ.dating);
})(typeof window !== 'undefined' ? window : globalThis, function (matcher, policy, dating) {
  const fields = ['name', 'title', 'company', 'industry', 'city', 'skills',
    'experience', 'projects', 'education', 'interests', 'goals', 'bio',
    'cooperation', 'markets', 'availability', 'compensation', 'employment', ...dating.cfg.fields];
  const optionalIntent = ['seekSkills', 'cooperation', 'markets', 'availability', 'compensation', 'employment'];
  const factors = ['needAB', 'needBA', 'complement', 'common'];
  function fail(code) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  function text(value, max = 300) {
    if (typeof value !== 'string') fail('INVALID_TEXT');
    return [...value.replace(/[\w.+-]+@[\w.-]+\.[a-z]+/gi, '[联系方式已省略]')
      .replace(/(?:微信|微讯|wechat|weixin|vx|QQ)\s*(?:号\s*)?(?:是|为)?\s*[:：=]?\s*(?:是|为)?\s*[a-z0-9_-]{5,}/gi, '[联系方式已省略]')
      .replace(/(?:https?:\/\/|www\.)\S+/gi, '[链接已省略]')
      .replace(/\+?\d[\d ()-]{8,}\d/g, '[号码已省略]')].slice(0, max).join('');
  }
  function strings(value) {
    if (!Array.isArray(value) || value.length > 20) fail('INVALID_LIST');
    return value.map(item => text(item, 80));
  }
  function intent(value) {
    if (!object(value)) fail('INVALID_INTENT');
    if (value.mode === 'dating' && (!dating.range(value.ageRange) ||
        !['男', '女', '不限'].includes(value.targetGender))) fail('INVALID_DATING_INTENT');
    return {
      seekRoles: strings(value.seekRoles), seekIndustries: strings(value.seekIndustries),
      offer: strings(value.offer), city: text(value.city, 40),
      ...Object.fromEntries(optionalIntent.filter(key => value[key] !== undefined)
        .map(key => [key, strings(value[key])])),
      ...dating.intent(value),
      ...(value.mode === 'dating' ? { interests: strings(value.interests || []) } : {}),
      ...Object.fromEntries(['lifestyle', 'values'].filter(k => value.mode === 'dating' && value[k] !== undefined).map(k => [k, strings(value[k])])),
    };
  }
  function projection(value) {
    if (object(value) && (value.versions || value.session)) value = matcher.project(value);
    if (!object(value) || !object(value.profile) || !Array.isArray(value.visibleFields)) fail('INVALID_PROJECTION');
    if (typeof value.id !== 'string' || !/^[\w-]{1,80}$/.test(value.id)) fail('INVALID_ID');
    const profile = {};
    for (const key of fields) {
      if (!value.visibleFields.includes(key) || value.profile[key] === undefined) continue;
      if (dating.cfg.fields.includes(key)) {
        if (value.cardType !== 'dating') continue;
        const item = value.profile[key];
        if (key === 'datingPreference') {
          if (!object(item) || !dating.range(item.ageRange) || !Array.isArray(item.genders) ||
              !item.genders.length || item.genders.some(g => !['男', '女'].includes(g))) fail('INVALID_DATING_PREFERENCE');
          profile[key] = { genders: strings(item.genders), ageRange: item.ageRange.slice(), priorities: strings(item.priorities || []) };
        } else if (key === 'birthYear') {
          if (!Number.isInteger(item) || dating.age({ birthYear: item }) < 18 || dating.age({ birthYear: item }) > 99) fail('INVALID_DATING_AGE');
          profile[key] = item;
        } else if (key === 'datingOpen') {
          if (typeof item !== 'boolean') fail('INVALID_DATING_CONSENT');
          profile[key] = item;
        } else profile[key] = Array.isArray(item) ? strings(item) : text(item);
        continue;
      }
      if (['skills', 'interests'].includes(key) && !Array.isArray(value.profile[key])) fail('INVALID_PROFILE_FIELD');
      profile[key] = Array.isArray(value.profile[key]) ? strings(value.profile[key]) : text(value.profile[key]);
    }
    return { id: value.id, profile, visibleFields: Object.keys(profile),
      ...(value.cardType === 'dating' ? { cardType: 'dating' } : {}),
      intent: intent(value.publicIntent === false ? matcher.blankIntent() : value.intent),
      ...(['checked_in', 'registered'].includes(value.status) ? { status: value.status } : {}),
      ...(typeof value.openToChat === 'boolean' ? { openToChat: value.openToChat } : {}) };
  }
  function request(value) {
    if (!object(value) || !Array.isArray(value.candidates) || !value.candidates.length || value.candidates.length > 24) fail('INVALID_CANDIDATES');
    const query = intent(value.intent);
    const cleanPerson = input => {
      const p = projection(input);
      if (query.mode === 'dating') return p;
      const clean = dating.professional(p);
      clean.visibleFields = Object.keys(clean.profile);
      delete clean.cardType;
      clean.intent = Object.fromEntries(Object.entries(clean.intent).filter(([k]) => !['mode', 'targetGender', 'ageRange', 'interests'].includes(k)));
      return clean;
    };
    const me = cleanPerson(value.me), candidates = value.candidates.map(cleanPerson);
    if (query.mode === 'dating' && (!dating.ready(me) || candidates.some(p => !dating.eligible(me, p, query)))) fail('DATING_NOT_ELIGIBLE');
    if (new Set(candidates.map(p => p.id)).size !== candidates.length) fail('DUPLICATE_ID');
    const local = value.local === undefined ? [] : value.local;
    if (!Array.isArray(local) || local.length > candidates.length) fail('INVALID_LOCAL_CONTEXT');
    const used = new Set();
    const context = local.map(row => {
      if (!object(row) || used.has(row.id) || !candidates.some(c => c.id === row.id) ||
          !Number.isFinite(row.score) || row.score < 0 || row.score > 100 ||
          !Number.isFinite(row.fresh) || row.fresh < 0 || row.fresh > 1) fail('INVALID_LOCAL_CONTEXT');
      used.add(row.id);
      return { id: row.id, score: row.score, fresh: row.fresh,
        greeted: row.greeted === true, met: row.met === true };
    });
    return { eventId: value.eventId === undefined ? '' : text(value.eventId, 80),
      intent: query, me, candidates, local: context };
  }
  function grounded(reason, candidate) {
    const p = candidate.profile;
    if (p.name && !reason.includes(p.name)) return false;
    const evidence = [p.industry, ...(p.skills || []), ...candidate.intent.offer,
      ...['cooperation', 'markets', 'availability', 'compensation', 'employment'].flatMap(k => p[k] || [])].filter(Boolean);
    return evidence.some(value => reason.includes(value));
  }
  const wording = reason => !policy.forbidden.some(word => reason.includes(word));
  const address = value => typeof value === 'string' ? value.replace(/您/g, '你') : value;
  function rerank(value, candidates, { repair, onDrop, dropped = [], mode, me } = {}) {
    const romantic = mode === 'dating';
    const evidence = (text, candidate) => romantic ? dating.grounded(text, me, candidate) : grounded(text, candidate);
    if (!Array.isArray(dropped) || dropped.some(id => !candidates.some(p => p.id === id)) ||
        new Set(dropped).size !== dropped.length) fail('INVALID_DROPPED_IDS');
    if (!object(value) || !Array.isArray(value.candidates) || value.candidates.length + dropped.length !== candidates.length) fail('INVALID_LLM_SCHEMA');
    const allowed = new Map(candidates.map(p => [p.id, p]));
    const used = new Set(dropped);
    const reasons = new Set();
    const results = value.candidates.map(row => {
      if (!object(row) || !allowed.has(row.id) || used.has(row.id)) fail('INVALID_LLM_ID');
      if (Object.keys(row).some(key => !['id', ...factors, 'score', 'reason', 'icebreaker', ...(romantic ? ['fitReason'] : [])].includes(key))) fail('INVALID_LLM_SCHEMA');
      used.add(row.id);
      const output = { id: row.id };
      for (const key of [...factors, 'score']) {
        if (!Number.isFinite(row[key]) || row[key] < 0 || row[key] > (key === 'score' ? 100 : 1)) fail('INVALID_LLM_RANGE');
        output[key] = row[key];
      }
      output.reason = text(address(row.reason), policy.reasonLimit);
      const question = text(address(row.icebreaker), policy.questionLimit);
      output.icebreaker = question.match(/^.*?[？?]/)?.[0] || question;
      const rawFit = address(row.fitReason);
      if (romantic) output.fitReason = typeof rawFit === 'string' ? text(rawFit, 60) : '';
      if (!output.reason || !output.icebreaker) fail('INVALID_LLM_TEXT');
      const badFit = romantic && (!output.fitReason || output.fitReason !== rawFit ||
        !dating.safe(output.fitReason) || !wording(output.fitReason) || !evidence(output.fitReason, allowed.get(row.id)));
      const badWording = !wording(output.reason) || !wording(output.icebreaker) ||
        (romantic && (!dating.safe(row.reason) || !dating.safe(row.icebreaker)));
      const code = badFit ? 'FIT_REASON_FALLBACK' : badWording ? 'REASON_WORDING_FALLBACK'
        : !evidence(output.reason, allowed.get(row.id)) ? 'REASON_EVIDENCE_FALLBACK'
        : reasons.has(output.reason) ? 'DUPLICATE_REASON'
        : !/[？?]$/.test(output.icebreaker) ? 'INCOMPLETE_QUESTION' : null;
      try {
        if (code && repair) {
          Object.assign(output, repair(allowed.get(row.id), code, reasons));
          output.reason = text(address(output.reason), policy.reasonLimit);
          output.icebreaker = text(address(output.icebreaker), policy.questionLimit);
        }
        if (!wording(output.reason) || !wording(output.icebreaker) ||
            (romantic && (!dating.safe(output.reason) || !dating.safe(output.icebreaker)))) fail('INVALID_REASON_WORDING');
        if (!evidence(output.reason, allowed.get(row.id))) fail('UNGROUNDED_REASON');
        if (romantic && (!output.fitReason || [...output.fitReason].length > 60 || !dating.safe(output.fitReason) ||
            !wording(output.fitReason) || !evidence(output.fitReason, allowed.get(row.id)))) fail('INVALID_FIT_REASON');
        if (!/[？?]$/.test(output.icebreaker)) fail('INCOMPLETE_QUESTION');
        if (reasons.has(output.reason)) fail('DUPLICATE_REASON');
      } catch (error) {
        if (!onDrop || !['NO_SAFE_REASON', 'INVALID_REASON_WORDING', 'UNGROUNDED_REASON',
          'INCOMPLETE_QUESTION', 'DUPLICATE_REASON', 'INVALID_FIT_REASON'].includes(error.code)) throw error;
        onDrop(row.id, error.code);
        return null;
      }
      reasons.add(output.reason);
      return output;
    });
    return results.filter(Boolean);
  }
  return { projection, request, intent, rerank, grounded, wording, fail, text, factors };
});
