const dating = require('../src/core/dating');
const settings = require('../src/core/dating-settings');
function scenarios(demo) {
  function make(eventId, text, male = false) {
    const me = structuredClone(demo.data.me), session = { status: 'checked_in', openToChat: true, intentText: text };
    if (male) Object.assign(me.profile, { name: '周言', gender: '男', birthYear: 1996,
      datingPreference: { genders: ['女'], ageRange: [25, 35], priorities: ['真诚', '尊重边界'] } });
    settings.enable(me, session, demo.data.me);
    session.intent = demo.engine.parseIntent(text, me.profile);
    return { name: (male ? '周言' : '林知夏') + ' · ' + demo.data.events.find(e => e.id === eventId).title,
      me: { ...me, session }, eventId, expectedGender: male ? '女' : '男', expectedTopic: male ? '看展' : '户外' };
  }
  return [make('ai-agent-night', '想找个男朋友，年龄相仿，最好也喜欢户外'),
    make('city-walk', '想找个男朋友，年龄相仿，最好也喜欢户外'),
    make('design-workshop', '想认识女生，年龄相仿，一起看展', true)];
}
function check(scenario, rows, demo) {
  const me = demo.engine.project(scenario.me), query = scenario.me.session.intent;
  const all = demo.data.people.filter(p => p.sessions[scenario.eventId])
    .map(p => demo.engine.project({ ...p, session: p.sessions[scenario.eventId] }))
    .filter(p => dating.eligible(me, p, query));
  const checks = {
    count: rows.length === Math.min(5, all.length),
    hardConditions: rows.every(r => dating.eligible(me, r.public, query) && r.public.profile.gender === scenario.expectedGender),
    age: rows.every(r => dating.age(r.public.profile) >= 25 && dating.age(r.public.profile) <= 35),
    interest: rows.every(r => dating.topics(me.profile, r.public.profile).includes(scenario.expectedTopic)),
    fitReason: rows.every(r => typeof r.fitReason === 'string' && [...r.fitReason].length <= 60 && dating.grounded(r.fitReason, me, r.public)),
    wording: rows.every(r => [r.reason, r.fitReason, r.icebreaker].every(v => dating.safe(v) && require('../src/core/llm-schema').wording(v))),
    privacy: rows.every(r => {
      const original = demo.data.people.find(p => p.id === r.id), output = r.reason + r.fitReason + r.icebreaker;
      return Object.entries(original.profile).filter(([k]) => !r.public.visibleFields.includes(k))
        .flatMap(([, value]) => typeof value === 'string' ? [value] : [])
        .filter(value => value.length > 1).every(value => !output.includes(value));
    }),
    sorted: rows.every((r, i) => !i || rows[i - 1].score >= r.score),
  };
  return { pass: Object.values(checks).every(Boolean), eligibleCount: all.length, checks };
}
module.exports = { scenarios, check };
