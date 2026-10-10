(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./dating'));
  else root.BJ.datingSettings = factory(root.BJ.dating);
})(typeof window !== 'undefined' ? window : globalThis, function (dating) {
  const clone = value => JSON.parse(JSON.stringify(value));
  function migrate(state, defaults) {
    const first = state.me.profile.datingOpen === undefined;
    for (const key of dating.cfg.fields) {
      if (state.me.profile[key] === undefined && defaults.profile[key] !== undefined) state.me.profile[key] = clone(defaults.profile[key]);
    }
    if (first) state.me.profile.datingOpen = false;
    if (!state.me.versions.some(v => v.id === 'dating')) state.me.versions.push(clone(defaults.versions.find(v => v.id === 'dating')));
    state.me.versions.forEach(v => {
      if (v.id !== 'dating') v.visibleFields = v.visibleFields.filter(k => !dating.cfg.fields.includes(k));
    });
    if (first) Object.values(state.participations).forEach(s => { s.datingOpen = false; });
    // Old saved phrases may have been parsed as only an industry such as 户外.
    // Recognize their mode now, without granting any disclosure or event consent.
    for (const session of Object.values(state.participations)) {
      const parsed = dating.parse(String(session.intentText || ''), state.me.profile);
      if (parsed && session.intent?.mode !== 'dating') {
        session.intent = { seekRoles: [], seekIndustries: [], offer: [], city: '', ...parsed };
        session.datingOpen = false;
      }
    }
  }
  function enable(person, session, defaults) {
    let version = person.versions.find(v => v.id === 'dating');
    if (!version) { version = clone(defaults.versions.find(v => v.id === 'dating')); person.versions.push(version); }
    version.visibleFields = [...new Set([...version.visibleFields, ...dating.cfg.fields])];
    person.profile.datingOpen = true;
    Object.assign(session, { versionId: 'dating', datingOpen: true, publicIntent: true });
  }
  function format(value) {
    if (typeof value === 'boolean') return value ? dating.cfg.copy.willing : dating.cfg.copy.closed;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return [(value.genders || []).join('/'), (value.ageRange || []).join('–') + '岁', (value.priorities || []).join('、')].filter(Boolean).join(' · ');
    }
    return Array.isArray(value) ? value.join('、') : String(value ?? '');
  }
  function editValue(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return Array.isArray(value) ? value.join(', ') : value ?? '';
    return [value.genders.join('/'), value.ageRange.join('-'), (value.priorities || []).join(',')].join('；');
  }
  function read(field, value) {
    if (field.key === 'birthYear') return /^\d{4}$/.test(value) ? Number(value) : null;
    if (field.key === 'datingOpen') return value === 'true';
    if (field.key === 'datingPreference') {
      const [gender = '', years = '', priorities = ''] = value.split(/[;；]/);
      return { genders: gender.includes('不限') ? ['男', '女'] : ['男', '女'].filter(g => gender.includes(g)),
        ageRange: years.split(/[-–至到]/).map(Number), priorities: priorities.split(/[,，、]/).map(v => v.trim()).filter(Boolean) };
    }
    return field.array ? value.split(/[,，、]/).map(v => v.trim()).filter(Boolean) : value;
  }
  return { migrate, enable, format, editValue, read };
});
